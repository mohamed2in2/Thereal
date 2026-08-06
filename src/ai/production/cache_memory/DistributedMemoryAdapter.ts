export type StorageProviderType = "Local" | "Redis" | "Database";

export class DistributedMemoryAdapter {
  private primaryStorage: StorageProviderType = "Local";
  private memoryStore: Map<string, string> = new Map();

  public setStorageProvider(provider: StorageProviderType): void {
    this.primaryStorage = provider;
  }

  public async saveState(key: string, value: Record<string, unknown>): Promise<boolean> {
    const serialized = JSON.stringify(value);
    this.memoryStore.set(key, serialized);
    return true;
  }

  public async getState<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const data = this.memoryStore.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }
}
