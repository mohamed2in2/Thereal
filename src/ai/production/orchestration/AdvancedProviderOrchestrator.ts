export type ProviderGroupType =
  | "Fast"
  | "Balanced"
  | "Reasoning"
  | "Vision"
  | "Voice"
  | "Premium"
  | "Experimental";

export interface ProviderNode {
  id: string;
  name: string;
  group: ProviderGroupType;
  priority: number;
  weight: number;
  healthy: boolean;
}

export class AdvancedProviderOrchestrator {
  private static instance: AdvancedProviderOrchestrator;
  private providers: Map<string, ProviderNode> = new Map();

  private constructor() {
    this.seedProviders();
  }

  public static getInstance(): AdvancedProviderOrchestrator {
    if (!AdvancedProviderOrchestrator.instance) {
      AdvancedProviderOrchestrator.instance = new AdvancedProviderOrchestrator();
    }
    return AdvancedProviderOrchestrator.instance;
  }

  private seedProviders(): void {
    this.registerProvider({ id: "mock_fast", name: "Mock Fast Engine", group: "Fast", priority: 1, weight: 80, healthy: true });
    this.registerProvider({ id: "mock_strong", name: "Mock Strong Reasoning", group: "Reasoning", priority: 1, weight: 90, healthy: true });
    this.registerProvider({ id: "mock_vision", name: "Mock Vision OCR", group: "Vision", priority: 1, weight: 100, healthy: true });
    this.registerProvider({ id: "mock_voice", name: "Mock Voice Audio", group: "Voice", priority: 1, weight: 100, healthy: true });
  }

  public registerProvider(node: ProviderNode): void {
    this.providers.set(node.id, node);
  }

  public selectOptimalProvider(group: ProviderGroupType): ProviderNode {
    const matching = Array.from(this.providers.values())
      .filter((p) => p.group === group && p.healthy)
      .sort((a, b) => b.weight - a.weight || a.priority - b.priority);

    if (matching.length > 0) {
      return matching[0];
    }

    // Default fallback provider
    return (
      this.providers.get("mock_fast") || {
        id: "default_fallback",
        name: "Default Fallback",
        group: "Fast",
        priority: 99,
        weight: 10,
        healthy: true,
      }
    );
  }
}
