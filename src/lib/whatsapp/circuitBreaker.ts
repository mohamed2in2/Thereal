import { logger } from "./logger";

export type CircuitBreakerState =
  | "HEALTHY"
  | "PROVIDER_UNHEALTHY"
  | "SESSION_INVALID"
  | "ACCOUNT_RESTRICTED";

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  isAvailable: boolean;
  consecutiveFailures: number;
  lastStateChange: string;
  lastFailureReason: string | null;
  lastFailureTime: string | null;
  isPermanentlyDisabled: boolean;
}

class WhatsAppCircuitBreaker {
  private state: CircuitBreakerState = "HEALTHY";
  private consecutiveFailures: number = 0;
  private lastStateChange: number = Date.now();
  private lastFailureReason: string | null = null;
  private lastFailureTime: number | null = null;

  // Configuration
  private readonly FAILURE_THRESHOLD = 3; // 3 consecutive network/timeout errors trips PROVIDER_UNHEALTHY

  public getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Returns true only if Baileys is fully healthy and authorized to send outbound messages.
   */
  public isBaileysAvailable(): boolean {
    return this.state === "HEALTHY";
  }

  /**
   * Records a successful dispatch or connection open event.
   */
  public recordSuccess(): void {
    // If account was flagged as restricted, we do NOT auto-heal unless explicitly reset by admin/re-auth.
    if (this.state === "ACCOUNT_RESTRICTED") {
      return;
    }

    if (this.consecutiveFailures > 0 || this.state !== "HEALTHY") {
      logger.info("WhatsApp circuit breaker restored to HEALTHY", {
        previousState: this.state,
        previousFailures: this.consecutiveFailures,
      });
    }

    this.consecutiveFailures = 0;
    this.lastFailureReason = null;
    this.transitionTo("HEALTHY");
  }

  /**
   * Evaluates errors and transitions circuit state to the appropriate failure category.
   *
   * 1. 403 Forbidden / Spam Block -> ACCOUNT_RESTRICTED (Disable provider completely)
   * 2. 401 / loggedOut -> SESSION_INVALID (Require QR re-scan, halt queue)
   * 3. Socket / Network / Timeout -> PROVIDER_UNHEALTHY (Pause Baileys, exponential backoff)
   */
  public recordFailure(error: any, statusCode?: number): void {
    const errorMsg = error?.message || String(error || "Unknown dispatch failure");
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.lastFailureReason = errorMsg;

    // Check 1: Account-Level Restriction (403 Forbidden / Account Banned)
    const isForbidden =
      statusCode === 403 ||
      statusCode === 405 ||
      /forbidden|banned|restricted|blocked|spam/i.test(errorMsg);

    if (isForbidden) {
      this.transitionTo("ACCOUNT_RESTRICTED");
      logger.error("CRITICAL: WhatsApp Account Restricted / 403 Forbidden. Disabling Baileys engine completely to prevent ban escalation.", {
        statusCode,
        error: errorMsg,
      });
      return;
    }

    // Check 2: Session Invalidation (401 / Logged Out / Invalid Auth)
    const isSessionInvalid =
      statusCode === 401 ||
      statusCode === 428 ||
      /logged out|unauthorized|session expired|bad-request/i.test(errorMsg);

    if (isSessionInvalid) {
      this.transitionTo("SESSION_INVALID");
      logger.warn("WhatsApp Session Invalidated. Halting Baileys queue until re-authentication.", {
        statusCode,
        error: errorMsg,
      });
      return;
    }

    // Check 3: Provider / Socket / Transient Network Unhealthy
    if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      if (this.state === "HEALTHY") {
        this.transitionTo("PROVIDER_UNHEALTHY");
        logger.warn("WhatsApp Circuit Breaker tripped to PROVIDER_UNHEALTHY due to consecutive failures.", {
          failures: this.consecutiveFailures,
          lastError: errorMsg,
        });
      }
    }
  }

  /**
   * Transitions circuit state and updates timestamps.
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Administrative manual reset (e.g. after scanning a new QR code or replacing account).
   */
  public reset(): void {
    logger.info("Admin reset triggered for WhatsApp circuit breaker");
    this.state = "HEALTHY";
    this.consecutiveFailures = 0;
    this.lastFailureReason = null;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
  }

  /**
   * Retrieves full status snapshot for observability & health endpoints.
   */
  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      isAvailable: this.isBaileysAvailable(),
      consecutiveFailures: this.consecutiveFailures,
      lastStateChange: new Date(this.lastStateChange).toISOString(),
      lastFailureReason: this.lastFailureReason,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      isPermanentlyDisabled: this.state === "ACCOUNT_RESTRICTED",
    };
  }
}

export const circuitBreaker = new WhatsAppCircuitBreaker();
