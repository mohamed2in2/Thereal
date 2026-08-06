export class LayeredTeacher {
  /**
   * Generates prompt instructions for the 5-layer pedagogical teaching framework.
   */
  public static getPromptInstructions(stopAtLayer = 5): string {
    return [
      `=== منهجية الشرح المتدرج (5-Layer Explanation Framework) ===`,
      `التزم بهذه الطبقات بترتيب متدرج:`,
      `- الطبقة 1 (Layer 1): شرح مبسط جداً للمفهوم.`,
      `- الطبقة 2 (Layer 2): بيان السبب والعلة (Explain Why).`,
      `- الطبقة 3 (Layer 3): التوضيح بمثال عملي تطبيقي.`,
      `- الطبقة 4 (Layer 4): عرض القاعدة العامة أو القانون العام.`,
      `- الطبقة 5 (Layer 5): تقديم فرصة ممارسة وتدريب واحدة سريعة.`,
      ``,
      `*قاعدة التوقف المبكر (Early Stopping Rule)*:`,
      `إذا كان استفسار الطالب يطلب مفهوماً محدداً وتم توضيح السبب الكافي في الطبقة 2، توقف ولا تواصل الشرح دون داعٍ لتوفير وقت الطالب وزيادة التركيز.`,
    ].join("\n");
  }

  public static formatLayeredResponse(
    layer1: string,
    layer2: string,
    layer3?: string,
    layer4?: string,
    layer5?: string
  ): string {
    const parts = [
      `### 1. المفهوم البسيط\n${layer1}`,
      `### 2. سبب وفلسفة المفهوم\n${layer2}`,
    ];

    if (layer3) parts.push(`### 3. مثال تطبيقي\n${layer3}`);
    if (layer4) parts.push(`### 4. القاعدة العامة\n${layer4}`);
    if (layer5) parts.push(`### 5. سؤال ممارسة سريع\n${layer5}`);

    return parts.join("\n\n");
  }
}
