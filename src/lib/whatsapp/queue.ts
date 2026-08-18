import { whatsappClient } from "./client";
import { sendRawWhatsAppMessage } from "./sender";
import { rateLimiter } from "./rateLimiter";
import { normalizePhoneToJid, validateMessageContent, formatOTPMessage } from "./formatter";
import { logger } from "./logger";
import { officialMetaProvider } from "./officialMetaProvider";
import { circuitBreaker } from "./circuitBreaker";

export type PriorityBand = "P0" | "P1" | "P2" | "P3";
export type FallbackPolicy = "META" | "NONE";
export type JobCategory = "OTP" | "PAYMENT" | "PARENT_LINK" | "NOTIFICATION" | "BULK" | "CUSTOM";

export interface WhatsAppJob {
  id: string;
  idempotencyKey: string;
  priority: PriorityBand;
  category: JobCategory;
  recipient: string; // E.164 phone
  jid: string;
  content: string;
  otpCode?: string;
  expiresAt: number; // TTL timestamp in ms
  fallbackPolicy: FallbackPolicy;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: number;
  resolve: (value: { success: boolean; messageId?: string; provider?: string; error?: string }) => void;
  reject: (reason: Error) => void;
}

export interface EnqueueJobOptions {
  recipient: string;
  content: string;
  priority?: PriorityBand;
  category?: JobCategory;
  idempotencyKey?: string;
  expiresInSeconds?: number;
  fallbackPolicy?: FallbackPolicy;
  otpCode?: string;
}

/**
 * Computes Gaussian-distributed jitter for queue pacing and burst smoothing.
 * Prevents accidental micro-bursts and smooths CPU/socket load.
 */
export function getGaussianJitter(meanMs: number, stdDevMs: number, minMs: number = 200): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.max(minMs, Math.floor(meanMs + z * stdDevMs));
}

class WhatsAppQueueManager {
  // 4 Isolated Priority Queues
  private p0Queue: WhatsAppJob[] = []; // OTP & Auth (Highest Priority)
  private p1Queue: WhatsAppJob[] = []; // Financial & Payment Receipts
  private p2Queue: WhatsAppJob[] = []; // Notifications & Parent Links
  private p3Queue: WhatsAppJob[] = []; // Bulk Announcements & Sync

  private isProcessing: boolean = false;
  private lastSendTimes: Record<PriorityBand, number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
  };

  // Mean Pacing Targets (with Gaussian Jitter)
  private readonly PACING_CONFIG = {
    P0: { meanMs: 0, stdDevMs: 0 },       // Immediate dispatch when socket is available
    P1: { meanMs: 2000, stdDevMs: 400 },  // ~2s spacing for payment receipts
    P2: { meanMs: 5000, stdDevMs: 1000 }, // ~5s spacing for parent/student notifications
    P3: { meanMs: 12000, stdDevMs: 2500 },// ~12s spacing for bulk broadcasts
  };

  // Idempotency tracking (deduplicate duplicate requests in memory)
  private completedJobs: Map<string, { success: boolean; messageId?: string; timestamp: number }> = new Map();
  private inFlightJobs: Map<string, Promise<{ success: boolean; messageId?: string; provider?: string }>> = new Map();

  constructor() {
    // Periodically prune completed jobs older than 10 minutes
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.pruneCompletedJobs(), 5 * 60 * 1000);
      if (timer && typeof timer.unref === "function") {
        timer.unref();
      }
    }
  }

  private pruneCompletedJobs() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of this.completedJobs.entries()) {
      if (val.timestamp < cutoff) {
        this.completedJobs.delete(key);
      }
    }
  }

  public getQueueLength(): number {
    return this.p0Queue.length + this.p1Queue.length + this.p2Queue.length + this.p3Queue.length;
  }

  public getQueueLengthsByBand(): Record<PriorityBand, number> {
    return {
      P0: this.p0Queue.length,
      P1: this.p1Queue.length,
      P2: this.p2Queue.length,
      P3: this.p3Queue.length,
    };
  }

  /**
   * Calculates the estimated wait time in milliseconds for a job entering the specified priority band.
   */
  public getEstimatedWaitTimeMs(priority: PriorityBand = "P2"): number {
    const p0Time = this.p0Queue.length * 500; // P0 is fast sub-second
    const p1Time = this.p1Queue.length * 2000;
    const p2Time = this.p2Queue.length * 5000;
    const p3Time = this.p3Queue.length * 12000;

    switch (priority) {
      case "P0":
        return p0Time;
      case "P1":
        return p0Time + p1Time;
      case "P2":
        return p0Time + p1Time + p2Time;
      case "P3":
        return p0Time + p1Time + p2Time + p3Time;
      default:
        return p0Time + p1Time + p2Time;
    }
  }

  /**
   * Universal Job Enqueue method with priority, idempotency, deadline TTL, and fallback policies.
   */
  public enqueueJob(options: EnqueueJobOptions): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
    const {
      recipient,
      content,
      priority = "P2",
      category = "NOTIFICATION",
      idempotencyKey = `${priority}-${category}-${recipient.replace(/\D/g, "")}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      expiresInSeconds = priority === "P0" ? 300 : 1800, // 5 min for P0, 30 min for P1/P2
      fallbackPolicy = priority === "P0" ? "META" : "NONE",
      otpCode,
    } = options;

    // Check Idempotency Cache
    const existingCompleted = this.completedJobs.get(idempotencyKey);
    if (existingCompleted) {
      logger.info("WhatsApp duplicate request resolved via idempotency cache", { idempotencyKey, recipient });
      return Promise.resolve({ success: existingCompleted.success, messageId: existingCompleted.messageId, provider: "IDEMPOTENT_CACHE" });
    }

    const inFlight = this.inFlightJobs.get(idempotencyKey);
    if (inFlight) {
      logger.info("WhatsApp in-flight request joined via idempotency key", { idempotencyKey, recipient });
      return inFlight;
    }

    const { phoneE164, jid } = normalizePhoneToJid(recipient);
    validateMessageContent(content);

    // If OTP, validate rate limiter
    if (category === "OTP") {
      const limitCheck = rateLimiter.checkOTPRateLimit(phoneE164);
      if (!limitCheck.allowed) {
        logger.warn("OTP request blocked by rate limiter", { phone: phoneE164, reason: limitCheck.reason });
        return Promise.reject(new Error(limitCheck.reason || "OTP rate limit exceeded."));
      }
    }

    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const estimatedWaitMs = this.getEstimatedWaitTimeMs(priority);

    // Deadline-based fallback evaluation:
    // If estimated wait exceeds remaining lifetime (minus 2s buffer) AND fallback is META -> dispatch via Meta immediately
    const timeRemainingMs = expiresAt - Date.now();
    if (estimatedWaitMs >= timeRemainingMs - 2000 && fallbackPolicy === "META") {
      logger.warn("Queue wait exceeds deadline SLA. Bypassing Baileys queue directly to Meta Cloud API.", {
        recipient: phoneE164,
        priority,
        estimatedWaitMs,
        timeRemainingMs,
      });

      return officialMetaProvider.sendMessage({
        recipient: phoneE164,
        content,
        messageType: category === "OTP" ? "OTP" : "CUSTOM",
      });
    }

    // Circuit Breaker Fast-Path:
    // If Baileys account is restricted or permanently disabled, route directly if Meta fallback is enabled
    if (circuitBreaker.getState() === "ACCOUNT_RESTRICTED") {
      if (fallbackPolicy === "META") {
        logger.info("Baileys account is restricted. Routing eligible job to Meta API.", { recipient: phoneE164, priority });
        return officialMetaProvider.sendMessage({
          recipient: phoneE164,
          content,
          messageType: category === "OTP" ? "OTP" : "CUSTOM",
        });
      } else {
        return Promise.reject(new Error("Baileys WhatsApp account is restricted (403 Forbidden). Non-fallback job rejected."));
      }
    }

    const promise = new Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }>((resolve, reject) => {
      const job: WhatsAppJob = {
        id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        idempotencyKey,
        priority,
        category,
        recipient: phoneE164,
        jid,
        content,
        otpCode,
        expiresAt,
        fallbackPolicy,
        attempts: 0,
        maxAttempts: 3,
        enqueuedAt: Date.now(),
        resolve: (val) => {
          this.completedJobs.set(idempotencyKey, { success: val.success, messageId: val.messageId, timestamp: Date.now() });
          this.inFlightJobs.delete(idempotencyKey);
          resolve(val);
        },
        reject: (err) => {
          this.inFlightJobs.delete(idempotencyKey);
          reject(err);
        },
      };

      this.pushToBand(job);
      logger.info("Enqueued WhatsApp job into priority band", {
        jobId: job.id,
        priority: job.priority,
        category: job.category,
        phone: phoneE164,
        totalQueue: this.getQueueLength(),
      });

      this.processNext();
    });

    this.inFlightJobs.set(idempotencyKey, promise);
    return promise;
  }

  /**
   * Push job into its respective priority band.
   */
  private pushToBand(job: WhatsAppJob): void {
    switch (job.priority) {
      case "P0":
        this.p0Queue.push(job);
        break;
      case "P1":
        this.p1Queue.push(job);
        break;
      case "P2":
        this.p2Queue.push(job);
        break;
      case "P3":
        this.p3Queue.push(job);
        break;
      default:
        this.p2Queue.push(job);
    }
  }

  /**
   * Dequeues the next available job adhering strictly to priority order (P0 > P1 > P2 > P3).
   */
  private getNextJob(): WhatsAppJob | null {
    if (this.p0Queue.length > 0) return this.p0Queue.shift()!;
    if (this.p1Queue.length > 0) return this.p1Queue.shift()!;
    if (this.p2Queue.length > 0) return this.p2Queue.shift()!;
    if (this.p3Queue.length > 0) return this.p3Queue.shift()!;
    return null;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.getQueueLength() === 0) return;
    this.isProcessing = true;

    const job = this.getNextJob();
    if (!job) {
      this.isProcessing = false;
      return;
    }

    try {
      // 1. Check TTL Expiration
      const now = Date.now();
      if (now >= job.expiresAt) {
        logger.warn("WhatsApp job expired before dispatch", { jobId: job.id, priority: job.priority, phone: job.recipient });
        job.reject(new Error(`Message job ${job.id} expired before reaching dispatch.`));
        return;
      }

      // 2. Evaluate Circuit Breaker State
      const circuitState = circuitBreaker.getState();
      if (circuitState === "ACCOUNT_RESTRICTED") {
        if (job.fallbackPolicy === "META") {
          logger.info("Circuit breaker restricted: dispatching job via Meta Cloud API", { jobId: job.id, phone: job.recipient });
          const metaRes = await officialMetaProvider.sendMessage({
            recipient: job.recipient,
            content: job.content,
            messageType: job.category === "OTP" ? "OTP" : "CUSTOM",
          });
          job.resolve(metaRes);
          return;
        } else {
          job.reject(new Error("Baileys account restricted. Dispatch cancelled."));
          return;
        }
      }

      if (circuitState === "PROVIDER_UNHEALTHY" || circuitState === "SESSION_INVALID") {
        if (job.fallbackPolicy === "META" && (job.priority === "P0" || job.expiresAt - now < 30000)) {
          logger.info("Circuit breaker degraded: dispatching urgent job via Meta API", { jobId: job.id, state: circuitState });
          const metaRes = await officialMetaProvider.sendMessage({
            recipient: job.recipient,
            content: job.content,
            messageType: job.category === "OTP" ? "OTP" : "CUSTOM",
          });
          job.resolve(metaRes);
          return;
        }
      }

      // 3. Enforce Priority-Based Pacing with Gaussian Jitter
      const pacing = this.PACING_CONFIG[job.priority];
      if (pacing.meanMs > 0) {
        const lastSend = this.lastSendTimes[job.priority];
        const timeSince = now - lastSend;
        const requiredDelay = getGaussianJitter(pacing.meanMs, pacing.stdDevMs, 500);

        if (timeSince < requiredDelay) {
          const waitMs = requiredDelay - timeSince;
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }

      // 4. Attempt Baileys Dispatch
      job.attempts++;
      if (!whatsappClient.isConnected()) {
        const isMainInstance = process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === "0";
        if (isMainInstance) {
          await whatsappClient.initialize();
        }

        if (!whatsappClient.isConnected()) {
          circuitBreaker.recordFailure(new Error("Socket disconnected"));
          if (job.fallbackPolicy === "META") {
            logger.info("Baileys disconnected: executing fallback to Meta Cloud API", { jobId: job.id });
            const metaRes = await officialMetaProvider.sendMessage({
              recipient: job.recipient,
              content: job.content,
              messageType: job.category === "OTP" ? "OTP" : "CUSTOM",
            });
            job.resolve(metaRes);
            return;
          }
          throw new Error("WhatsApp socket disconnected. Retrying in background.");
        }
      }

      const socket = whatsappClient.getSocket();
      await sendRawWhatsAppMessage(socket, job.jid, job.content);

      // Record successful dispatch
      const sentTime = Date.now();
      this.lastSendTimes[job.priority] = sentTime;
      circuitBreaker.recordSuccess();

      if (job.category === "OTP") {
        rateLimiter.recordOTPSend(job.recipient);
      }

      logger.info("Successfully dispatched WhatsApp job via Baileys", {
        jobId: job.id,
        priority: job.priority,
        phone: job.recipient,
        queueRemaining: this.getQueueLength(),
      });

      job.resolve({ success: true, provider: "BAILEYS", messageId: job.id });
    } catch (err: any) {
      const statusCode = err?.output?.statusCode || err?.status;
      circuitBreaker.recordFailure(err, statusCode);

      logger.error("Failed to dispatch WhatsApp job", {
        jobId: job.id,
        phone: job.recipient,
        attempt: job.attempts,
        error: err.message,
      });

      // If retryable and attempts remain
      if (job.attempts < job.maxAttempts && !err.message?.includes("Invalid phone number") && circuitBreaker.getState() !== "ACCOUNT_RESTRICTED") {
        const retryDelay = 2000 * Math.pow(2, job.attempts - 1);
        await new Promise((r) => setTimeout(r, retryDelay));
        this.pushToBand(job); // Re-queue for next attempt
      } else {
        // Fallback to Meta API if eligible before giving up
        if (job.fallbackPolicy === "META") {
          try {
            logger.info("Baileys max attempts reached. Executing final failover to Meta Cloud API", { jobId: job.id });
            const metaRes = await officialMetaProvider.sendMessage({
              recipient: job.recipient,
              content: job.content,
              messageType: job.category === "OTP" ? "OTP" : "CUSTOM",
            });
            job.resolve(metaRes);
            return;
          } catch (metaErr: any) {
            job.reject(new Error(`Both Baileys and Meta fallback failed: ${metaErr.message}`));
            return;
          }
        }
        job.reject(err);
      }
    } finally {
      this.isProcessing = false;
      if (this.getQueueLength() > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  // --- Compatibility Wrappers ---
  public enqueue(rawPhone: string, text: string, isOtp: boolean = false): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.enqueueJob({
      recipient: rawPhone,
      content: text,
      priority: isOtp ? "P0" : "P2",
      category: isOtp ? "OTP" : "NOTIFICATION",
      fallbackPolicy: isOtp ? "META" : "NONE",
    });
  }

  public enqueueMessage(rawPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.enqueueJob({
      recipient: rawPhone,
      content: text,
      priority: "P2",
      category: "NOTIFICATION",
      fallbackPolicy: "NONE",
    });
  }

  public enqueueOTP(rawPhone: string, otpCode: string, customTemplate?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const content = formatOTPMessage(otpCode, customTemplate);
    return this.enqueueJob({
      recipient: rawPhone,
      content,
      priority: "P0",
      category: "OTP",
      otpCode,
      expiresInSeconds: 300, // 5 min TTL
      fallbackPolicy: "META",
    });
  }
}

export const messageQueue = new WhatsAppQueueManager();
