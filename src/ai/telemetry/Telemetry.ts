import { EducationalActionType, TelemetryEvent, TelemetryMetrics } from "../types";

export class Telemetry {
  private static instance: Telemetry;
  private events: TelemetryEvent[] = [];
  private maxStoreSize = 1000;

  public static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  public recordEvent(event: Omit<TelemetryEvent, "id" | "timestamp">): TelemetryEvent {
    const fullEvent: TelemetryEvent = {
      ...event,
      id: `tel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    if (this.events.length > this.maxStoreSize) {
      this.events.shift();
    }

    return fullEvent;
  }

  public getEvents(limit = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  public getMetrics(): TelemetryMetrics {
    const totalRequests = this.events.length;
    const successfulRequests = this.events.filter((e) => e.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const totalLatency = this.events.reduce((sum, e) => sum + e.latencyMs, 0);
    const averageLatencyMs = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const totalTokensUsed = this.events.reduce((sum, e) => sum + (e.inputTokens + e.outputTokens), 0);

    const requestsByAction: Record<EducationalActionType, number> = {} as Record<EducationalActionType, number>;
    const requestsByProvider: Record<string, number> = {};

    for (const e of this.events) {
      requestsByAction[e.action] = (requestsByAction[e.action] || 0) + 1;
      requestsByProvider[e.provider] = (requestsByProvider[e.provider] || 0) + 1;
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatencyMs,
      totalTokensUsed,
      requestsByAction,
      requestsByProvider,
    };
  }

  public clear(): void {
    this.events = [];
  }
}
