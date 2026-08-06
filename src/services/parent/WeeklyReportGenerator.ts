import { StudentWeeklyStats, ParentStatsCalculator } from "./ParentStatsCalculator";
import { ParentProfile } from "./ParentService";

export interface WeeklyReportOutput {
  parentId: string;
  studentId: string;
  studentName: string;
  reportGeneratedAt: string;
  title: string;
  body: string;
  smsBody: string;
  notifyChannels: string[];
}

export class WeeklyReportGenerator {
  private static instance: WeeklyReportGenerator;
  private statsCalculator: ParentStatsCalculator;

  private constructor() {
    this.statsCalculator = ParentStatsCalculator.getInstance();
  }

  public static getInstance(): WeeklyReportGenerator {
    if (!WeeklyReportGenerator.instance) {
      WeeklyReportGenerator.instance = new WeeklyReportGenerator();
    }
    return WeeklyReportGenerator.instance;
  }

  /**
   * Generates a structured, formatted weekly report for a given student and parent.
   * Statistics are computed from platform database — AI is NOT involved here.
   */
  public generateReport(studentId: string, parent: ParentProfile): WeeklyReportOutput {
    const stats = this.statsCalculator.calculateWeeklyStats(studentId);
    return this.buildReport(stats, parent);
  }

  public generateFromStats(stats: StudentWeeklyStats, parent: ParentProfile): WeeklyReportOutput {
    return this.buildReport(stats, parent);
  }

  private buildReport(stats: StudentWeeklyStats, parent: ParentProfile): WeeklyReportOutput {
    const studyTimeFormatted = this.statsCalculator.formatStudyTime(stats.studyTimeMinutes);
    const now = new Date().toLocaleString("ar-EG", { dateStyle: "full" });
    const relationship = parent.relationship === "Father" ? "ولي الأمر الكريم" :
      parent.relationship === "Mother" ? "ولية الأمر الكريمة" : "ولي الأمر الكريم";

    const subjectLines = stats.subjectScores
      .map(s => `  • ${s.subject}: ${s.scorePercentage}%`)
      .join("\n");

    const weakTopicsLine = stats.weakTopics.length > 0
      ? stats.weakTopics.slice(0, 2).join(" | ")
      : "لا يوجد";

    const body = `
📊 التقرير الأسبوعي للطالب
${now}

${relationship} / ${parent.name}،
السلام عليكم ورحمة الله وبركاته

نقدم لكم ملخص أداء الطالب ${stats.studentName} للأسبوع الحالي:

━━━━━━━━━━━━━━━━━━━━━
📚 أداء المواد:
${subjectLines}

━━━━━━━━━━━━━━━━━━━━━
📈 إحصائيات الأسبوع:
  • الدروس المشاهدة: ${stats.lessonsWatched} درس
  • الفيديوهات المكتملة: ${stats.videosCompleted}
  • الواجبات المسلّمة: ${stats.homeworkSubmitted} / ${stats.homeworkTotal}
  • متوسط الواجبات: ${stats.homeworkAverage}%
  • الاختبارات المكتملة: ${stats.quizCompleted} / ${stats.quizTotal}
  • متوسط الاختبارات: ${stats.quizAverage}%
  • وقت الدراسة: ${studyTimeFormatted}
  • التسلسل الحالي: ${stats.currentStreak} يوم متواصل 🔥

━━━━━━━━━━━━━━━━━━━━━
⚠️ مواضيع تحتاج مراجعة:
  ${weakTopicsLine}

💪 مواضيع متميز فيها:
  ${stats.strongTopics.slice(0, 2).join(" | ")}

━━━━━━━━━━━━━━━━━━━━━
📌 توصية الأسبوع القادم:
  مراجعة موضوع "${stats.weakTopics[0] || "المادة الأضعف"}" في أقرب فرصة.

شكراً لثقتكم في منصة Code-UP ✨
    `.trim();

    const smsBody = `Code-UP | تقرير أسبوعي للطالب ${stats.studentName}: رياضيات ${stats.subjectScores[0]?.scorePercentage || 0}% | واجبات ${stats.homeworkSubmitted}/${stats.homeworkTotal} | اختبارات ${stats.quizCompleted}/${stats.quizTotal} | وقت الدراسة ${studyTimeFormatted}`;

    return {
      parentId: parent.id,
      studentId: stats.studentId,
      studentName: stats.studentName,
      reportGeneratedAt: new Date().toISOString(),
      title: `📊 التقرير الأسبوعي للطالب ${stats.studentName}`,
      body,
      smsBody,
      notifyChannels: parent.notificationPreferences,
    };
  }
}
