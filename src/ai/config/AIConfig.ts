import { AIConfig, ProviderConfig } from "../types";

/**
 * Default AI Engine Configuration.
 * Fully configurable via environment variables or runtime setters.
 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  primaryProvider: process.env.AI_PRIMARY_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "mock"),
  fallbackProviders: (process.env.AI_FALLBACK_PROVIDERS || "gemini,mock,deepseek_v4_flash,deepseek")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  providers: {
    digitalocean: {
      apiKey: process.env.DIGITALOCEAN_API_KEY || "wbj5Ee7xbTENBOTBf1OBnPfX67WW2v79",
      baseUrl: process.env.DIGITALOCEAN_BASE_URL || "https://inference.do.co/v1",
      model: process.env.DIGITALOCEAN_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
      enabled: true,
    },
    mock: {
      enabled: true,
      model: "mock-v1",
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      enabled: true,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o",
      enabled: true,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      enabled: true,
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
      model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
      enabled: true,
    },
    qwen: {
      apiKey: process.env.QWEN_API_KEY || "",
      baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: process.env.QWEN_MODEL || "qwen-max",
      enabled: true,
    },
    grok: {
      apiKey: process.env.GROK_API_KEY || "",
      baseUrl: process.env.GROK_BASE_URL || "https://api.x.ai/v1",
      model: process.env.GROK_MODEL || "grok-beta",
      enabled: true,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL || "auto",
      enabled: true,
    },
    openai_compatible: {
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY || "",
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || "http://localhost:11434/v1",
      model: process.env.OPENAI_COMPATIBLE_MODEL || "llama3",
      enabled: true,
    },
  },
  temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "2048", 10),
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || "30000", 10),
  retryCount: parseInt(process.env.AI_RETRY_COUNT || "1", 10),
  streamingEnabled: process.env.AI_STREAMING_ENABLED !== "false",
  cachingEnabled: process.env.AI_CACHING_ENABLED !== "false",
  supportedLanguages: ["ar", "en"],
  defaultLanguage: "ar",
  teachingStyle: "Socratic, encouraging, clear, structured with practical step-by-step guidance",
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AIConfig;

  private constructor(initialConfig?: Partial<AIConfig>) {
    this.config = { ...DEFAULT_AI_CONFIG, ...initialConfig };
  }

  public static getInstance(initialConfig?: Partial<AIConfig>): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(initialConfig);
    }
    return ConfigManager.instance;
  }

  public getConfig(): AIConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AIConfig>): AIConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      providers: {
        ...this.config.providers,
        ...(newConfig.providers || {}),
      },
    };
    return this.getConfig();
  }

  public getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.config.providers[providerId];
  }

  public setProviderConfig(providerId: string, providerConfig: ProviderConfig): void {
    this.config.providers[providerId] = providerConfig;
  }

  public resetToDefaults(): void {
    this.config = { ...DEFAULT_AI_CONFIG };
  }
}
