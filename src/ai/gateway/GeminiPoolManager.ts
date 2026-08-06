export type AccountHealth = "Healthy" | "CoolingDown" | "Disabled";

export interface AccountStats {
  keyId: string;
  secretKey: string;
  requestsToday: number;
  requestsThisMinute: number;
  tokensToday: number;
  tokensThisMinute: number;
  health: AccountHealth;
  lastError: string | null;
  cooldownUntil: number | null;
  averageLatencyMs: number;
  remainingQuota: number; // 0 - 100 percentage
  scorePenalties: number;
  totalSuccesses: number;
}

export class GeminiPoolManager {
  private static instance: GeminiPoolManager;
  private accounts: Map<string, AccountStats> = new Map();
  private lastResetDay = new Date().getDate();
  private lastResetMinute = new Date().getMinutes();

  private constructor() {
    this.discoverAccountsFromEnv();
  }

  public static getInstance(): GeminiPoolManager {
    if (!GeminiPoolManager.instance) {
      GeminiPoolManager.instance = new GeminiPoolManager();
    }
    return GeminiPoolManager.instance;
  }

  /**
   * Scans process.env for all GEMINI_KEY_* and GEMINI_API_KEY* entries dynamically.
   */
  public discoverAccountsFromEnv(): void {
    const env = process.env;
    let found = 0;

    for (const [key, value] of Object.entries(env)) {
      if ((key.startsWith("GEMINI_KEY_") || key.startsWith("GEMINI_API_KEY")) && value && value.trim().length > 0) {
        const keyId = key.toLowerCase();
        if (!this.accounts.has(keyId)) {
          this.accounts.set(keyId, {
            keyId,
            secretKey: value.trim(),
            requestsToday: 0,
            requestsThisMinute: 0,
            tokensToday: 0,
            tokensThisMinute: 0,
            health: "Healthy",
            lastError: null,
            cooldownUntil: null,
            averageLatencyMs: 150,
            remainingQuota: 100,
            scorePenalties: 0,
            totalSuccesses: 0,
          });
          found++;
        }
      }
    }

    // Fallback stub account if no env vars present
    if (this.accounts.size === 0) {
      this.accounts.set("gemini_default_sandbox", {
        keyId: "gemini_default_sandbox",
        secretKey: "sandbox_gemini_key",
        requestsToday: 0,
        requestsThisMinute: 0,
        tokensToday: 0,
        tokensThisMinute: 0,
        health: "Healthy",
        lastError: null,
        cooldownUntil: null,
        averageLatencyMs: 100,
        remainingQuota: 100,
        scorePenalties: 0,
        totalSuccesses: 0,
      });
    }
  }

  /**
   * Selects the optimal Gemini API account based on composite score:
   * Score = RemainingQuota * 35% + Health * 25% + Latency * 15% + MinuteUsage * 15% + DailyUsage * 10%
   */
  public selectBestAccount(): AccountStats {
    this.checkAutoReset();
    this.updateCooldownStatuses();

    let bestAccount: AccountStats | null = null;
    let highestScore = -Infinity;

    for (const account of this.accounts.values()) {
      if (account.health === "Disabled") continue;

      if (account.health === "CoolingDown") {
        if (account.cooldownUntil && Date.now() < account.cooldownUntil) {
          continue; // Still cooling down
        } else {
          // Cooldown expired
          account.health = "Healthy";
          account.cooldownUntil = null;
        }
      }

      const score = this.calculateAccountScore(account);
      if (score > highestScore) {
        highestScore = score;
        bestAccount = account;
      }
    }

    if (!bestAccount) {
      // If all accounts cooling down/disabled, pick healthiest or default
      const allAccounts = Array.from(this.accounts.values());
      bestAccount = allAccounts.find(a => a.health !== "Disabled") || allAccounts[0];
    }

    return bestAccount;
  }

  public calculateAccountScore(account: AccountStats): number {
    const quotaScore = account.remainingQuota * 0.35;
    const healthScore = (account.health === "Healthy" ? 100 : account.health === "CoolingDown" ? 20 : 0) * 0.25;
    const latencyScore = Math.max(0, 100 - (account.averageLatencyMs / 20)) * 0.15;
    const minuteUsageScore = Math.max(0, 100 - (account.requestsThisMinute * 5)) * 0.15;
    const dailyUsageScore = Math.max(0, 100 - (account.requestsToday / 50)) * 0.10;

    const total = quotaScore + healthScore + latencyScore + minuteUsageScore + dailyUsageScore - account.scorePenalties;
    return Math.max(0, total);
  }

  public recordSuccess(keyId: string, tokens: number, latencyMs: number): void {
    const account = this.accounts.get(keyId);
    if (!account) return;

    account.requestsToday++;
    account.requestsThisMinute++;
    account.tokensToday += tokens;
    account.tokensThisMinute += tokens;
    account.totalSuccesses++;

    // Exponential moving average latency calculation
    account.averageLatencyMs = Math.round(account.averageLatencyMs * 0.8 + latencyMs * 0.2);

    // Slowly recover quota & penalties
    account.remainingQuota = Math.max(10, account.remainingQuota - 0.05);
    account.scorePenalties = Math.max(0, account.scorePenalties - 1);

    // Safe logging (NEVER logs secret key string)
    const estimatedCostUsd = (tokens / 1000) * 0.00015;
    console.log(
      `[GeminiPoolManager] Account '${account.keyId}' Executed Successfully | Tokens: ${tokens} | Latency: ${latencyMs}ms | Est. Cost: $${estimatedCostUsd.toFixed(6)} | Remaining Quota: ${account.remainingQuota.toFixed(1)}%`
    );
  }

  public recordRateLimit(keyId: string, retryAfterMs = 60000): void {
    const account = this.accounts.get(keyId);
    if (!account) return;

    account.health = "CoolingDown";
    account.cooldownUntil = Date.now() + retryAfterMs;
    account.lastError = `429 Rate Limit (Cooldown ${retryAfterMs / 1000}s)`;
    account.remainingQuota = Math.max(5, account.remainingQuota - 20);

    console.warn(`[GeminiPoolManager] Account '${account.keyId}' hit 429 Rate Limit. Cooling down for ${retryAfterMs / 1000}s.`);
  }

  public recordUnauthorized(keyId: string): void {
    const account = this.accounts.get(keyId);
    if (!account) return;

    account.health = "Disabled";
    account.lastError = "401 Unauthorized / Invalid API Key";
    account.remainingQuota = 0;

    console.error(`[GeminiPoolManager] Account '${account.keyId}' returned 401 Unauthorized. Account permanently DISABLED.`);
  }

  public recordServerError(keyId: string, errorMsg: string): void {
    const account = this.accounts.get(keyId);
    if (!account) return;

    account.scorePenalties += 15;
    account.lastError = `5xx Server Error: ${errorMsg}`;

    console.warn(`[GeminiPoolManager] Account '${account.keyId}' returned 5xx Server Error. Temporary score penalty applied (+15).`);
  }

  public getAllAccountStats(): Omit<AccountStats, "secretKey">[] {
    return Array.from(this.accounts.values()).map(acc => {
      const { secretKey, ...safeStats } = acc;
      return safeStats;
    });
  }

  private updateCooldownStatuses(): void {
    const now = Date.now();
    for (const account of this.accounts.values()) {
      if (account.health === "CoolingDown" && account.cooldownUntil && now >= account.cooldownUntil) {
        account.health = "Healthy";
        account.cooldownUntil = null;
      }
    }
  }

  private checkAutoReset(): void {
    const now = new Date();

    if (now.getDate() !== this.lastResetDay) {
      for (const acc of this.accounts.values()) {
        acc.requestsToday = 0;
        acc.tokensToday = 0;
        acc.remainingQuota = 100;
      }
      this.lastResetDay = now.getDate();
    }

    if (now.getMinutes() !== this.lastResetMinute) {
      for (const acc of this.accounts.values()) {
        acc.requestsThisMinute = 0;
        acc.tokensThisMinute = 0;
      }
      this.lastResetMinute = now.getMinutes();
    }
  }
}
