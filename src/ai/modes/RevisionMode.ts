export class RevisionMode {
  public static getInstructions(): string {
    return [
      `=== نمط المراجعة المركز السريعة (Revision Mode) ===`,
      `- ركز حصرياً على المفاهيم عالية القيمة في الامتحانات (High-Value Concepts).`,
      `- تجنب تكرار الفصل كاملاً؛ قدم ملخصات مكثفة ومباشرة.`,
      `- ولد أسئلة استدعاء سريع (Active Recall Questions) لتثبيت الفهم.`,
    ].join("\n");
  }
}
