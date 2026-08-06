export interface BenchmarkQuestion {
  id: string;
  subject: string;
  question: string;
  expectedAnswer: string;
  keywords: string[];
}

export class BenchmarkSuite {
  private static benchmarks: BenchmarkQuestion[] = [
    { id: "bm_math_1", subject: "Mathematics", question: "حل المعادلة سين + 5 = 12", expectedAnswer: "س = 7", keywords: ["7", "س"] },
    { id: "bm_phys_1", subject: "Physics", question: "ما هو قانون أوم؟", expectedAnswer: "الجهد = التيار * المقاومة", keywords: ["الجهد", "التيار", "المقاومة"] },
    { id: "bm_chem_1", subject: "Chemistry", question: "ما هو الرمز الكيميائي للماء؟", expectedAnswer: "H2O", keywords: ["H2O"] },
    { id: "bm_bio_1", subject: "Biology", question: "ما هي البلاستيدات الخضراء؟", expectedAnswer: "عضيات البناء الضوئي في النبتة", keywords: ["البناء الضوئي"] },
    { id: "bm_ar_1", subject: "Arabic", question: "ما هو الفاعل في جملة: كتب الطالبُ الدرسَ؟", expectedAnswer: "الطالبُ", keywords: ["الطالب"] },
    { id: "bm_eng_1", subject: "English", question: "What is the past tense of 'go'?", expectedAnswer: "went", keywords: ["went"] },
    { id: "bm_prog_1", subject: "Programming", question: "كيف نعرّف متغير ثابت في JavaScript؟", expectedAnswer: "const", keywords: ["const"] },
    { id: "bm_hist_1", subject: "History", question: "من قاد ثورة 1919 في مصر؟", expectedAnswer: "سعد زغلول", keywords: ["سعد زغلول"] },
    { id: "bm_geo_1", subject: "Geography", question: "ما هو أطول نهر في العالم؟", expectedAnswer: "نهر النيل", keywords: ["النيل"] },
  ];

  public static getBenchmarks(subject?: string): BenchmarkQuestion[] {
    if (!subject) return [...this.benchmarks];
    return this.benchmarks.filter((b) => b.subject.toLowerCase() === subject.toLowerCase());
  }
}
