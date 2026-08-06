export interface ProviderStats {
  providerId: string;
  status: "Healthy" | "Degraded" | "Offline";
  successCount: number;
  failureCount: number;
  retryCount: number;
  fallbackCount: number;
  rateLimit429Count: number;
  auth401Count: number;
  serverError5xxCount: number;
  timeoutCount: number;
  totalLatencyMs: number;
  requestCount: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  estimatedCostUsd: number;
  cacheHits: number;
  cacheMisses: number;
  currentRpm: number;  // rolling requests-per-minute
  currentTpm: number;  // rolling tokens-per-minute
  dailyRequests: number;
  dailyTokens: number;
  hourlyRequests: number;
  hourlyTokens: number;
}

export class ProviderMonitor {
  private static instance: ProviderMonitor;
  private stats: Map<string, ProviderStats> = new Map();
  private minuteWindow: Map<string, { requests: number; tokens: number; resetAt: number }> = new Map();
  private hourWindow: Map<string, { requests: number; tokens: number; resetAt: number }> = new Map();

  public static getInstance(): ProviderMonitor {
    if (!ProviderMonitor.instance) {
      ProviderMonitor.instance = new ProviderMonitor();
    }
    return ProviderMonitor.instance;
  }

  private ensureProvider(providerId: string): ProviderStats {
    if (!this.stats.has(providerId)) {
      this.stats.set(providerId, {
        providerId,
        status: "Healthy",
        successCount: 0, failureCount: 0, retryCount: 0, fallbackCount: 0,
        rateLimit429Count: 0, auth401Count: 0, serverError5xxCount: 0, timeoutCount: 0,
        totalLatencyMs: 0, requestCount: 0,
        promptTokensTotal: 0, completionTokensTotal: 0, estimatedCostUsd: 0,
        cacheHits: 0, cacheMisses: 0,
        currentRpm: 0, currentTpm: 0,
        dailyRequests: 0, dailyTokens: 0,
        hourlyRequests: 0, hourlyTokens: 0,
      });
    }
    return this.stats.get(providerId)!;
  }

  public recordSuccess(providerId: string, params: {
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    cacheHit: boolean;
  }): void {
    const s = this.ensureProvider(providerId);
    s.successCount++;
    s.requestCount++;
    s.totalLatencyMs += params.latencyMs;
    s.promptTokensTotal += params.promptTokens;
    s.completionTokensTotal += params.completionTokens;
    s.estimatedCostUsd += params.costUsd;
    s.dailyRequests++;
    s.dailyTokens += params.promptTokens + params.completionTokens;
    if (params.cacheHit) { s.cacheHits++; } else { s.cacheMisses++; }
    this.updateWindows(providerId, params.promptTokens + params.completionTokens);

    if (s.failureCount > 0 && s.successCount / s.requestCount > 0.9) s.status = "Healthy";
  }

  public recordFailure(providerId: string, type: "rate_limit" | "auth" | "server_error" | "timeout" | "other"): void {
    const s = this.ensureProvider(providerId);
    s.failureCount++;
    s.requestCount++;
    if (type === "rate_limit") s.rateLimit429Count++;
    else if (type === "auth") { s.auth401Count++; s.status = "Offline"; }
    else if (type === "server_error") { s.serverError5xxCount++; s.status = "Degraded"; }
    else if (type === "timeout") s.timeoutCount++;
    this.updateWindows(providerId, 0);
  }

  public recordRetry(providerId: string): void { this.ensureProvider(providerId).retryCount++; }
  public recordFallback(providerId: string): void { this.ensureProvider(providerId).fallbackCount++; }

  private updateWindows(providerId: string, tokens: number): void {
    const now = Date.now();
    const minuteReset = Math.floor(now / 60000) * 60000 + 60000;
    const hourReset = Math.floor(now / 3600000) * 3600000 + 3600000;

    const min = this.minuteWindow.get(providerId) || { requests: 0, tokens: 0, resetAt: minuteReset };
    if (now > min.resetAt) { min.requests = 0; min.tokens = 0; min.resetAt = minuteReset; }
    min.requests++;
    min.tokens += tokens;
    this.minuteWindow.set(providerId, min);

    const hr = this.hourWindow.get(providerId) || { requests: 0, tokens: 0, resetAt: hourReset };
    if (now > hr.resetAt) { hr.requests = 0; hr.tokens = 0; hr.resetAt = hourReset; }
    hr.requests++;
    hr.tokens += tokens;
    this.hourWindow.set(providerId, hr);

    const s = this.stats.get(providerId)!;
    s.currentRpm = min.requests;
    s.currentTpm = min.tokens;
    s.hourlyRequests = hr.requests;
    s.hourlyTokens = hr.tokens;
  }

  public getStats(providerId: string): ProviderStats { return this.ensureProvider(providerId); }

  public getAllStats(): ProviderStats[] { return Array.from(this.stats.values()); }

  public getAverageLatency(providerId: string): number {
    const s = this.stats.get(providerId);
    if (!s || s.requestCount === 0) return 0;
    return Math.round(s.totalLatencyMs / s.requestCount);
  }

  public getSuccessRate(providerId: string): number {
    const s = this.stats.get(providerId);
    if (!s || s.requestCount === 0) return 100;
    return Math.round((s.successCount / s.requestCount) * 100);
  }

  public getCacheHitRate(providerId: string): number {
    const s = this.stats.get(providerId);
    if (!s || (s.cacheHits + s.cacheMisses) === 0) return 0;
    return Math.round((s.cacheHits / (s.cacheHits + s.cacheMisses)) * 100);
  }
}
