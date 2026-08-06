export type MemoryTechniqueType = "mnemonic" | "analogy" | "visual" | "chunking" | "story";

export class MemoryTechniques {
  public static getPromptInstructions(): string {
    return [
      `=== تقنيات الذاكرة وتسهيل الحفظ (Memory Techniques) ===`,
      `- ابتكر طرق تذكر ذكية (Mnemonics, Analogies, Visual Associations, Chunking).`,
      `- استخدم هذه التقنيات فقط عندما تكون مفيدة وتسهل المفاهيم المعقدة.`,
      `- تجنب فرض حيل الذاكرة إذا كان المفهوم واضحاً ومباشراً.`,
    ].join("\n");
  }

  public static generateTechniquePrompt(concept: string, type: MemoryTechniqueType = "analogy"): string {
    switch (type) {
      case "mnemonic":
        return `ابتكر رمز اختصار حرفي (Mnemonic) ذكي لتذكر عناصر (${concept}).`;
      case "visual":
        return `تخيل وصفاً بصرياً (Visual Association) يربط بين شكل ودور (${concept}).`;
      case "chunking":
        return `قسم وقسم عناصر (${concept}) إلى 3 مجموعات صغيرة سهلة الحفظ (Chunking).`;
      case "story":
        return `اكتب قصة قصيرة جداً من سطرين تربط خطوات (${concept}).`;
      case "analogy":
      default:
        return `قدم تشبيهاً من الحياة اليومية (Analogy) يشرح فكرة (${concept}).`;
    }
  }
}
