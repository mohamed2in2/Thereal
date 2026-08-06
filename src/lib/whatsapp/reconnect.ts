import { logger } from "./logger";

class ReconnectManager {
  private attempts: number = 0;
  private maxAttempts: number = 20;
  private baseDelayMs: number = 3000;
  private maxDelayMs: number = 60000;

  public getAttempts(): number {
    return this.attempts;
  }

  public resetReconnectAttempts(): void {
    if (this.attempts > 0) {
      logger.info("Resetting reconnect attempt counter", { previousAttempts: this.attempts });
      this.attempts = 0;
    }
  }

  public getNextReconnectDelay(): number | null {
    if (this.attempts >= this.maxAttempts) {
      logger.warn("Maximum reconnect attempts reached. Manual reconnection required.", {
        attempts: this.attempts,
        maxAttempts: this.maxAttempts,
      });
      return null;
    }

    this.attempts++;
    // Exponential backoff: baseDelay * 2^(attempts-1) with jitter
    const expDelay = this.baseDelayMs * Math.pow(2, this.attempts - 1);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(expDelay + jitter, this.maxDelayMs);

    logger.info("Calculated exponential backoff reconnect delay", {
      attempt: this.attempts,
      delayMs: delay,
    });

    return delay;
  }
}

export const reconnectManager = new ReconnectManager();
