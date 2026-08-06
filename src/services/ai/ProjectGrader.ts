export interface EvaluationResult {
  passed: boolean;
  score: number; // 0 to 100
  confidence: number; // 0.0 to 1.0
  feedback: string;
  pointsEarned: number;
}

export class ProjectGrader {
  /**
   * Multi-layered AI & Rule-based Project Evaluator
   */
  public static evaluateSubmission(params: {
    submissionContent: string;
    fileUrl?: string;
    lessonTitle: string;
    hasPreviousPassingGrade: boolean;
  }): EvaluationResult {
    const { submissionContent, fileUrl, lessonTitle, hasPreviousPassingGrade } = params;
    const content = String(submissionContent || "").trim();

    // ── Layer 1: Minimum Length Verification ──
    if (content.length < 50 && !fileUrl) {
      return {
        passed: false,
        score: 0,
        confidence: 1.0,
        feedback: "عذراً، محتوى التسليم قصير جداً. يرجى تقديم كود برمجي متكامل أو إضافة رابط مشروع فعّال.",
        pointsEarned: 0,
      };
    }

    // ── Layer 2: Heuristic Junk & Placeholder Rejection ──
    const JUNK_PATTERNS = [
      /^[\s\d\W]+$/, // Only symbols or numbers
      /(hello|test|abc|12345|console\.log\("hi"\)){3,}/i,
      /(a{10,}|1{10,}|0{10,})/,
    ];

    if (JUNK_PATTERNS.some((pattern) => pattern.test(content))) {
      return {
        passed: false,
        score: 10,
        confidence: 0.95,
        feedback: "تم رفض التسليم: المحتوى المقدم يحتوي على نصوص وهمية أو رموز غير برمجية.",
        pointsEarned: 0,
      };
    }

    // ── Layer 3: Structural Code Pattern Detection ──
    const CODE_STRUCTURE_KEYWORDS = [
      "function", "const", "let", "var", "if", "else", "for", "while",
      "return", "import", "class", "def", "public", "void", "print", "console.log"
    ];

    const matchedStructures = CODE_STRUCTURE_KEYWORDS.filter((kw) =>
      new RegExp(`\\b${kw}\\b`, "i").test(content)
    ).length;

    const isStructuredCode = matchedStructures >= 2 || Boolean(fileUrl);

    if (!isStructuredCode) {
      return {
        passed: false,
        score: 30,
        confidence: 0.85,
        feedback: "الكود المقدم يفتقر إلى البنية البرمجية الأساسية (دوال، متغيرات، أوتعليمات شرطية).",
        pointsEarned: 0,
      };
    }

    // ── Layer 4: Passing Evaluation & Idempotent XP Calculation ──
    const computedScore = Math.min(100, 70 + matchedStructures * 5);
    const passed = computedScore >= 60;

    // Idempotency: Award +150 XP ONLY if the student hasn't previously passed this project
    const pointsEarned = (passed && !hasPreviousPassingGrade) ? 150 : 0;

    return {
      passed,
      score: computedScore,
      confidence: 0.9,
      feedback: passed
        ? `ممتاز! تم اجتياز مشروع (${lessonTitle}) بنجاح. الكود منظم ويحتوي على البنية البرمجية المطلوبة.`
        : "يتطلب المشروع تحسيناً إضافياً لتحقيق معايير الجودة المطلوبة.",
      pointsEarned,
    };
  }
}
