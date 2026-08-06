export class FlashcardMode {
  public static getInstructions(): string {
    return [
      `=== نمط بطاقات الاستذكار السريع (Flashcard Mode) ===`,
      `- صمم بطاقات ذاكرة مخصصة:`,
      `  1. السؤال / المصطلح المفتاحي.`,
      `  2. الإجابة المركزية الموجزة.`,
      `  3. نصيحة ذاكرة لتسهيل الحفظ (Memory Tip).`,
      `- نسق البطاقات في جدول أو بطاقات Markdown واضحة.`,
    ].join("\n");
  }
}
