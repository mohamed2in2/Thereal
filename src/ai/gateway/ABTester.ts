export interface ABTestResult {
  variant: "A" | "B";
  selectedProvider: string;
}

export class ABTester {
  private static instance: ABTester;
  private enabled = process.env.AI_AB_TESTING_ENABLED === "true";
  private variantAProvider = process.env.AB_VARIANT_A || "mock";
  private variantBProvider = process.env.AB_VARIANT_B || "openai_compatible";

  public static getInstance(): ABTester {
    if (!ABTester.instance) {
      ABTester.instance = new ABTester();
    }
    return ABTester.instance;
  }

  public getVariant(userId = "anon"): ABTestResult {
    if (!this.enabled) {
      return { variant: "A", selectedProvider: this.variantAProvider };
    }

    // Deterministic hash assignment based on userId
    const charCodeSum = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const isVariantA = charCodeSum % 2 === 0;

    return {
      variant: isVariantA ? "A" : "B",
      selectedProvider: isVariantA ? this.variantAProvider : this.variantBProvider,
    };
  }
}
