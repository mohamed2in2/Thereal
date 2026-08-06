export interface AIPlugin {
  id: string;
  name: string;
  category: "UniversityAdvisor" | "CareerGuidance" | "MathCAS" | "CodingAssistant" | "Translation" | "LabSimulator";
  version: string;
  sandboxed: boolean;
  execute: (input: string) => Promise<{ result: string }>;
}

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, AIPlugin> = new Map();

  private constructor() {
    this.seedDefaultPlugins();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  private seedDefaultPlugins(): void {
    this.registerPlugin({
      id: "plg_math_cas",
      name: "Computer Algebra System",
      category: "MathCAS",
      version: "1.0.0",
      sandboxed: true,
      execute: async (input: string) => ({ result: `CAS Output: Simplified [${input}]` }),
    });
  }

  public registerPlugin(plugin: AIPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  public getPlugin(id: string): AIPlugin | undefined {
    return this.plugins.get(id);
  }
}
