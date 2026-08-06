import { StudentEducationalState } from "./StudentStateMachine";

export class TeachingStrategyAdapter {
  public static getStrategyInstructions(state: StudentEducationalState): string {
    switch (state) {
      case "FAILED_MULTIPLE":
      case "REVISION_REQUIRED":
        return [
          `=== استراتيجية التدريس الحالية: مراجعة مكثفة وتسهيل استثنائي (${state}) ===`,
          `- الطالب واجه صعوبة تكررت في الاختبارات.`,
          `- اعمد إلى الشرح الطبقي المبسط للغاية (Layer 1 & Layer 2).`,
          `- قدم تلميحات تشجيعية وتجنب التقريع تماماً.`,
          `- ركز على الأفكار المفتاحية وسؤال ممارسة واحد مباشر.`,
        ].join("\n");

      case "EXAM_PREPARATION":
        return [
          `=== استراتيجية التدريس الحالية: التحضير للامتحانات (${state}) ===`,
          `- ركز على أسئلة الامتحانات الشاملة وحيل فخاخ الامتحانات (Exam Traps).`,
          `- اضبط الصياغة لتكون محاكية للأسئلة الأكاديمية الرسمية.`,
        ].join("\n");

      case "READY_FOR_NEXT":
      case "MASTERING_TOPIC":
        return [
          `=== استراتيجية التدريس الحالية: الجاهزية والتحدي (${state}) ===`,
          `- أظهر الطالب استيعاباً ممتازاً للدروس السابقة.`,
          `- شجع الطالب على الانتقال للدرس التالي أو حل أسئلة تحدٍ متقدمة.`,
        ].join("\n");

      case "WATCHING_LESSON":
      case "READING":
      case "DOING_HOMEWORK":
      case "PRACTICING":
      default:
        return [
          `=== استراتيجية التدريس الحالية: التوجيه والدعم القياسي (${state}) ===`,
          `- قدم شرحاً وتوجيهاً متوازناً يتماشى مع المنهج.`,
        ].join("\n");
    }
  }
}
