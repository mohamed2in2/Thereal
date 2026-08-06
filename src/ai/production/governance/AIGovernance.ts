export interface GovernancePolicy {
  id: string;
  name: string;
  category: "Privacy" | "Security" | "Integrity" | "BiasPrevention";
  enabled: boolean;
  rules: string[];
}

export class AIGovernance {
  private static instance: AIGovernance;
  private policies: Map<string, GovernancePolicy> = new Map();

  private constructor() {
    this.seedPolicies();
  }

  public static getInstance(): AIGovernance {
    if (!AIGovernance.instance) {
      AIGovernance.instance = new AIGovernance();
    }
    return AIGovernance.instance;
  }

  private seedPolicies(): void {
    this.policies.set("pol_privacy", {
      id: "pol_privacy",
      name: "حماية الخصوصية والبيانات الشخصية",
      category: "Privacy",
      enabled: true,
      rules: ["عدم تخزين بيانات الطالب الشخصية في ذاكرة النموذج الخارجية"],
    });

    this.policies.set("pol_integrity", {
      id: "pol_integrity",
      name: "النزاهة الأكاديمية والتربوية",
      category: "Integrity",
      enabled: true,
      rules: ["عدم تقديم حل مباشر للواجب دون خطوات تعليمية وبنائية"],
    });
  }

  public isPolicyActive(policyId: string): boolean {
    const pol = this.policies.get(policyId);
    return pol ? pol.enabled : false;
  }
}
