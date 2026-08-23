export type CurriculumChapter =
  | "community"
  | "cybersecurity"
  | "web"
  | "media"
  | "python";

export type CurriculumQuestion = {
  id: string;
  chapter: CurriculumChapter;
  chapterTitle: string;
  lessonTitle: string;
  lessonNumber: string;
  sourceFile: string;
  bookPage: number;
  question: string;
  code?: string;
  choices: string[];
  answer: string;
  explanation: string;
  revisionPrompt: string;
};

export const CURRICULUM_CHAPTERS: Array<{
  id: CurriculumChapter;
  label: string;
  shortLabel: string;
}> = [
  { id: "community", label: "تكنولوجيا المعلومات والمجتمع", shortLabel: "تكنولوجيا المجتمع" },
  { id: "cybersecurity", label: "الأمن السيبراني", shortLabel: "الأمن السيبراني" },
  { id: "web", label: "تطبيقات الويب", shortLabel: "تطبيقات الويب" },
  { id: "media", label: "تصميم الويب والوسائط", shortLabel: "تصميم الوسائط" },
  { id: "python", label: "البيانات وبايثون والذكاء الاصطناعي", shortLabel: "بايثون والبيانات" },
];

const PART_ONE = "Programming-ArtificialIntelligence-Ar-EB-part1.pdf";
const PART_TWO = "Programming-ArtificialIntelligence-Ar-EB-part2_260819_202159.pdf";

export const CURRICULUM_QUESTIONS: readonly CurriculumQuestion[] = [
  // ─── Chapter 1: Information Technology & Society ───────────────────────────
  {
    id: "community-ai-ethics-01",
    chapter: "community",
    chapterTitle: "تكنولوجيا المعلومات والمجتمع",
    lessonTitle: "القضايا الأخلاقية للذكاء الاصطناعي",
    lessonNumber: "1-4",
    sourceFile: PART_ONE,
    bookPage: 24,
    question: "تطبيق ذكاء اصطناعي يرشّح محتوى للطلاب. ما الممارسة الأخلاقية الأهم قبل نشره؟",
    code: "recommendations = model.predict(student_data)\n# قبل النشر: ؟",
    choices: [
      "التحقق من التحيّز والخصوصية ودقة التوصيات",
      "زيادة سرعة النموذج فقط",
      "إخفاء طريقة جمع البيانات عن المستخدم",
      "اعتماد كل إجابة لأن النموذج ذكي",
    ],
    answer: "التحقق من التحيّز والخصوصية ودقة التوصيات",
    explanation: "يربط المنهج استخدام الذكاء الاصطناعي بالمسؤولية: نتحقق من جودة النتائج، ونحمي البيانات، ونراجع التحيّز قبل اتخاذ قرار أو نشر نظام.",
    revisionPrompt: "راجعي درس 1-4 «القضايا الأخلاقية للذكاء الاصطناعي»، خصوصًا الخصوصية والتحيز والتحقق من النتائج.",
  },
  {
    id: "community-ai-bias-02",
    chapter: "community",
    chapterTitle: "تكنولوجيا المعلومات والمجتمع",
    lessonTitle: "القضايا الأخلاقية للذكاء الاصطناعي",
    lessonNumber: "1-4",
    sourceFile: PART_ONE,
    bookPage: 26,
    question: "كيف يحدث التحيّز (Bias) في نماذج الذكاء الاصطناعي وخوارزميات اتخاذ القرار؟",
    choices: [
      "عند تدريب النموذج على بيانات غير متوازنة أو أحادية الجانب",
      "بسبب كتابة الكود بلغة بايثون",
      "عند تشغيل النموذج على خوادم سحابية سريعة",
      "بسبب تقليل عدد المعاملات الرياضية",
    ],
    answer: "عند تدريب النموذج على بيانات غير متوازنة أو أحادية الجانب",
    explanation: "الذكاء الاصطناعي يتعلم من البيانات؛ إذا كانت بيانات التدريب تحتوي على تحيز أو نقص في التمثيل لفئة معينة، سينتج النموذج قرارات وتنبؤات متحيزة.",
    revisionPrompt: "راجعي درس 1-4 «القضايا الأخلاقية للذكاء الاصطناعي»، وركزي على أسباب حدوث التحيز في بيانات التدريب وكيفية تداركه.",
  },

  // ─── Chapter 2: Cybersecurity ──────────────────────────────────────────────
  {
    id: "cyber-symmetric-key-01",
    chapter: "cybersecurity",
    chapterTitle: "الأمن السيبراني",
    lessonTitle: "تقنيات التشفير والمصادقة",
    lessonNumber: "2-1",
    sourceFile: PART_ONE,
    bookPage: 35,
    question: "أي عبارة تصف التشفير المتماثل (Symmetric Encryption) بدقة؟",
    code: "ciphertext = encrypt(message, secret_key)\nmessage = decrypt(ciphertext, secret_key)",
    choices: [
      "يُستخدم المفتاح السري نفسه للتشفير وفك التشفير",
      "لا يحتاج إلى أي مفتاح سري",
      "يستخدم مفتاحًا عامًا فقط دون الحاجة لأي حماية",
      "يحوّل النص إلى صورة ثنائية لا يمكن فكّها أبدًا",
    ],
    answer: "يُستخدم المفتاح السري نفسه للتشفير وفك التشفير",
    explanation: "في التشفير المتماثل يشترك الطرفان في مفتاح سري واحد، لذلك يجب حمايته أثناء نقله وتخزينه لضمان السرية.",
    revisionPrompt: "راجعي درس 2-1 «تقنيات التشفير والمصادقة»، وقارني بين المفتاح المتماثل والمفتاحين العام والخاص.",
  },
  {
    id: "cyber-authentication-01",
    chapter: "cybersecurity",
    chapterTitle: "الأمن السيبراني",
    lessonTitle: "تقنيات التشفير والمصادقة",
    lessonNumber: "2-1",
    sourceFile: PART_ONE,
    bookPage: 37,
    question: "ما الهدف الأساسي من تطبيق المصادقة متعددة العوامل (MFA)؟",
    choices: [
      "إثبات هوية المستخدم بأكثر من عامل مستقل لتقليل مخاطر الاختراق",
      "تقصير طول كلمة المرور لتكون أسهل في التذكر",
      "إلغاء الحاجة إلى تحديث كلمات المرور الدورية",
      "إتاحة الحساب لأي جهاز متصل بالشبكة دون تحقق إضافي",
    ],
    answer: "إثبات هوية المستخدم بأكثر من عامل مستقل لتقليل مخاطر الاختراق",
    explanation: "تجمع المصادقة متعددة العوامل بين عوامل مثل المعرفة (كلمة المرور) والامتلاك (رمز الهاتف) والصفة الحيوية (البصمة) لتقليل أثر تسريب عامل واحد.",
    revisionPrompt: "راجعي درس 2-1 «تقنيات التشفير والمصادقة»، وتذكري أنواع عوامل المصادقة الثلاثة.",
  },
  {
    id: "cyber-asymmetric-key-02",
    chapter: "cybersecurity",
    chapterTitle: "الأمن السيبراني",
    lessonTitle: "تصميم أمن الشبكات",
    lessonNumber: "2-2",
    sourceFile: PART_ONE,
    bookPage: 40,
    question: "في التشفير غير المتماثل، أي مفتاح يُستخدم لفك تشفير الرسالة المرسلة إليك؟",
    code: "encrypted = encrypt(message, recipient_public_key)\noriginal = decrypt(encrypted, ؟)",
    choices: [
      "المفتاح الخاص بالمستقبل (Private Key)",
      "المفتاح العام للمرسل (Public Key)",
      "المفتاح العام للمستقبل (Public Key)",
      "مفتاح الشبكة التلقائي",
    ],
    answer: "المفتاح الخاص بالمستقبل (Private Key)",
    explanation: "في التشفير غير المتماثل (Asymmetric)، يُشفر النص بالمفتاح العام للمستلم، ولا يمكن فك تشفيره إلا بالمفتاح الخاص السري الذي يحتفظ به المستلم وحده.",
    revisionPrompt: "راجعي درس 2-2 «تصميم أمن الشبكات»، وتذكري ثنائية (المفتاح العام للتشفير، والمفتاح الخاص لفك التشفير).",
  },
  {
    id: "cyber-phishing-03",
    chapter: "cybersecurity",
    chapterTitle: "الأمن السيبراني",
    lessonTitle: "الاستجابة للحوادث وإدارة المخاطر",
    lessonNumber: "2-3",
    sourceFile: PART_ONE,
    bookPage: 45,
    question: "ما هو الهجوم السيبراني الذي يعتمد على إرسال رسائل أو روابط خادعة لانتحال صفة جهة رسمية وسرقة البيانات؟",
    choices: [
      "التصيد الاحتيالي (Phishing)",
      "التشفير المتماثل (Symmetric Cryptography)",
      "هجوم حجب الخدمة الموزع (DDoS)",
      "فحص المنافذ الشبكية (Port Scanning)",
    ],
    answer: "التصيد الاحتيالي (Phishing)",
    explanation: "التصيد الاحتيالي (Phishing) هو أحد أشهر أساليب الهندسة الاجتماعية؛ حيث ينتحل المهاجم صفة موقع موثوق لخداع الضحية وإدخال بياناته الحساسة.",
    revisionPrompt: "راجعي درس 2-3 «الاستجابة للحوادث وإدارة المخاطر»، وميزي بين أساليب الهندسة الاجتماعية والهجمات البرمجية.",
  },

  // ─── Chapter 3: Web Applications ───────────────────────────────────────────
  {
    id: "web-http-method-01",
    chapter: "web",
    chapterTitle: "تطبيقات الويب",
    lessonTitle: "طرق الاتصال في تطبيقات الويب",
    lessonNumber: "3-2",
    sourceFile: PART_ONE,
    bookPage: 57,
    question: "أي طلب HTTP يناسب جلب بيانات الدروس وقراءتها دون تعديلها على الخادم؟",
    code: "fetch('/api/lessons', {\n  method: '؟'\n})",
    choices: ["GET", "POST", "DELETE", "PATCH"],
    answer: "GET",
    explanation: "يُستخدم GET لطلب مورد أو قراءة بيانات من الخادم. أما POST وPATCH وDELETE فتُستخدم لإنشاء أو تعديل أو حذف البيانات.",
    revisionPrompt: "راجعي درس 3-2 «طرق الاتصال في تطبيقات الويب»، خاصة وظائف GET وPOST وPATCH وDELETE.",
  },
  {
    id: "web-client-server-01",
    chapter: "web",
    chapterTitle: "تطبيقات الويب",
    lessonTitle: "البنية العامة لتطبيقات الويب",
    lessonNumber: "3-1",
    sourceFile: PART_ONE,
    bookPage: 50,
    question: "في نموذج Client–Server، أين يجب تنفيذ التحقق الأمني الحاسم من هوية وصلاحيات المستخدم؟",
    code: "client -> request(userId) -> server\n// القرار النهائي الحاسم: ؟",
    choices: [
      "على الخادم (Server) بعد التحقق من الجلسة والصلاحيات الموثقة",
      "في ملف CSS بإخفاء الأزرار الحساسة",
      "في JavaScript داخل المتصفح فقط",
      "داخل عنوان URL الذي يرسله المستخدم في المتصفح",
    ],
    answer: "على الخادم (Server) بعد التحقق من الجلسة والصلاحيات الموثقة",
    explanation: "المتصفح بيئة غير موثوقة يمكن للمهاجم تعديل كودها وطلباتها. لذلك يبقى الخادم هو المرجع الحاسم والوحيد للتحقق من الصلاحيات وحماية البيانات.",
    revisionPrompt: "راجعي درس 3-1 «البنية العامة لتطبيقات الويب»، وركزي على توزيع المسؤوليات بين العميل والخادم.",
  },
  {
    id: "web-http-status-02",
    chapter: "web",
    chapterTitle: "تطبيقات الويب",
    lessonTitle: "أساسيات تكنولوجيا الواجهة الأمامية",
    lessonNumber: "3-3",
    sourceFile: PART_ONE,
    bookPage: 63,
    question: "أي رمز استجابة HTTP يعبر عن أن الصفحة أو المورد المطلوب غير موجود على الخادم؟",
    code: "const res = await fetch('/api/unknown-endpoint');\n// res.status === ؟",
    choices: ["404 Not Found", "200 OK", "500 Internal Server Error", "301 Moved Permanently"],
    answer: "404 Not Found",
    explanation: "الرمز 404 يشير إلى أن المورد المطلوب غير موجود على الخادم، بينما 200 تعني النجاح، و500 تعني عطل داخلي في الخادم.",
    revisionPrompt: "راجعي درس 3-3 «أساسيات تكنولوجيا الواجهة الأمامية»، وافهمي دلالة الفئات (2xx للنجاح، 4xx لأخطاء العميل، 5xx لأخطاء الخادم).",
  },

  // ─── Chapter 4: Media & UI/UX Design ───────────────────────────────────────
  {
    id: "media-flexbox-01",
    chapter: "media",
    chapterTitle: "تصميم الويب والوسائط",
    lessonTitle: "تصميم المعلومات وتجربة المستخدم للمواقع",
    lessonNumber: "4-2",
    sourceFile: PART_ONE,
    bookPage: 74,
    question: "ما الخاصية التي تتحكم في توزيع عناصر Flex على المحور الرئيسي داخل الحاوية؟",
    code: ".toolbar {\n  display: flex;\n  justify-content: space-between;\n}",
    choices: [
      "توزيع العناصر والمساحات على المحور الرئيسي",
      "تغيير لون خط النص داخل العناصر",
      "تحديد سمك الإطار الخارجي للحاوية",
      "إخفاء العناصر خارج نطاق الشاشة",
    ],
    answer: "توزيع العناصر والمساحات على المحور الرئيسي",
    explanation: "خاصية justify-content تتحكم في توزيع العناصر والمساحات على المحور الرئيسي في Flexbox وفقاً لاتجاه الحاوية.",
    revisionPrompt: "راجعي درس 4-2 «تصميم المعلومات وتجربة المستخدم للمواقع»، وطبقي Flexbox وGrid على تخطيط متجاوب.",
  },
  {
    id: "media-accessibility-01",
    chapter: "media",
    chapterTitle: "تصميم الويب والوسائط",
    lessonTitle: "أساليب تقييم المواقع الإلكترونية",
    lessonNumber: "4-3",
    sourceFile: PART_ONE,
    bookPage: 81,
    question: "أي ممارسة تحسن إمكانية الوصول (Accessibility) لصورة توضيحية هامة في الصفحة؟",
    code: '<img src="chart.png" alt="؟">',
    choices: [
      "كتابة وصف موجز ودقيق في خاصية alt يوضح معنى الصورة ومحتواها",
      "ترك خاصية alt فارغة دائمًا في كل الصور",
      "وضع النص داخل اسم ملف الصورة فقط",
      "استخدام لون خافت جداً للنص التوضيحي لتوفير المساحة",
    ],
    answer: "كتابة وصف موجز ودقيق في خاصية alt يوضح معنى الصورة ومحتواها",
    explanation: "النص البديل (alt) يمكّن قارئات الشاشة والتقنيات المساعدة من نقل المعنى الحقيقي للصور للطلاب والمستخدمين من ذوي الاحتياجات الخاصة.",
    revisionPrompt: "راجعي درس 4-3 «أساليب تقييم المواقع الإلكترونية»، خصوصًا إمكانية الوصول والتباين والتنقل بلوحة المفاتيح.",
  },
  {
    id: "media-css-grid-02",
    chapter: "media",
    chapterTitle: "تصميم الويب والوسائط",
    lessonTitle: "تصميم المعلومات وتجربة المستخدم للمواقع",
    lessonNumber: "4-2",
    sourceFile: PART_ONE,
    bookPage: 78,
    question: "ما الخاصية المستخدمة في CSS Grid لتحديد عدد وأبعاد الأعمدة داخل الحاوية؟",
    code: ".grid-layout {\n  display: grid;\n  /* تقسيم إلى 3 أعمدة متساوية: */\n  grid-template-columns: repeat(3, 1fr);\n}",
    choices: [
      "grid-template-columns",
      "flex-direction",
      "font-weight",
      "background-attachment",
    ],
    answer: "grid-template-columns",
    explanation: "تحدد خاصية grid-template-columns عدد الأعمدة ومقاييسها في نظام الشبكة ثنائي الأبعاد (CSS Grid).",
    revisionPrompt: "راجعي درس 4-2 «تصميم المعلومات وتجربة المستخدم للمواقع»، وقارني بين Flexbox (أحادي البعد) وGrid (ثنائي الأبعاد).",
  },
  {
    id: "media-responsive-design-03",
    chapter: "media",
    chapterTitle: "تصميم الويب والوسائط",
    lessonTitle: "عملية التحسين التكراري للمواقع",
    lessonNumber: "4-4",
    sourceFile: PART_ONE,
    bookPage: 88,
    question: "ما القاعدة المستخدمة في CSS لتطبيق تنسيقات مخصصة وفقاً لحجم شاشة الجهاز (مثل الهواتف)؟",
    code: "@media (max-width: 640px) {\n  .sidebar { display: none; }\n}",
    choices: [
      "استعلامات الوسائط (@media queries)",
      "الرسوم المتحركة (@keyframes)",
      "تضمين الخطوط (@font-face)",
      "استيراد الملفات (@import)",
    ],
    answer: "استعلامات الوسائط (@media queries)",
    explanation: "تسمح استعلامات الوسائط @media بتغيير التنسيقات وفقاً لحجم الشاشة واتجاه الجهاز لتحقيق تجربة مستخدم متجاوبة (Responsive).",
    revisionPrompt: "راجعي درس 4-4 «عملية التحسين التكراري للمواقع»، وتدربي على كتابة نقاط التوقف (Breakpoints).",
  },

  // ─── Chapter 5: Python, Data & AI ──────────────────────────────────────────
  {
    id: "python-list-slice-01",
    chapter: "python",
    chapterTitle: "البيانات وبايثون والذكاء الاصطناعي",
    lessonTitle: "تنقية البيانات وتحويلها",
    lessonNumber: "5-2",
    sourceFile: PART_TWO,
    bookPage: 11,
    question: "ما الناتج الذي يطبعه الكود التالي في بايثون؟",
    code: "scores = [10, 20, 30, 40]\nprint(scores[1:3])",
    choices: ["[10, 20]", "[20, 30]", "[20, 30, 40]", "[10, 20, 30]"],
    answer: "[20, 30]",
    explanation: "التقطيع في Python يبدأ من الفهرس الأول المحدد (1) ويتوقف قبل فهرس النهاية (3)؛ لذلك نأخذ العنصرين عند الفهرسين 1 و2.",
    revisionPrompt: "راجعي درس 5-2 «تنقية البيانات وتحويلها»، وتدربي على الفهارس والتقطيع في القوائم.",
  },
  {
    id: "python-dict-01",
    chapter: "python",
    chapterTitle: "البيانات وبايثون والذكاء الاصطناعي",
    lessonTitle: "تنقية البيانات وتحويلها",
    lessonNumber: "5-2",
    sourceFile: PART_TWO,
    bookPage: 16,
    question: "كيف نصل إلى قيمة المفتاح city في قاموس بايثون التالي؟",
    code: 'profile = {"city": "Cairo", "grade": 11}\nprint(؟)',
    choices: ["profile.city", "profile['city']", "profile->city", "city[profile]"],
    answer: "profile['city']",
    explanation: "القاموس يخزن أزواج مفتاح وقيمة (Key-Value)، ونصل إلى القيمة باستخدام اسم القاموس متبوعاً بالمفتاح بين قوسين معقوفين.",
    revisionPrompt: "راجعي درس 5-1 «طرق جمع البيانات»، وطبقي إنشاء القواميس والوصول إلى قيمها في بايثون.",
  },
  {
    id: "python-api-integration-02",
    chapter: "python",
    chapterTitle: "البيانات وبايثون والذكاء الاصطناعي",
    lessonTitle: "البيانات المفتوحة وواجهات برمجة التطبيقات",
    lessonNumber: "5-3",
    sourceFile: PART_TWO,
    bookPage: 21,
    question: "ما هي واجهة برمجة التطبيقات (API) المستخدمة في بايثون لتبادل البيانات مع الخدمات السحابية؟",
    choices: [
      "واجهة برمجية تسمح لبرنامجين بالتواصل وتبادل البيانات تلقائياً",
      "كابل توصيل مادي بين شاشتين",
      "طريقة لضغط الصور فقط",
      "ملف نصي لتخزين كلمات المرور محلياً",
    ],
    answer: "واجهة برمجية تسمح لبرنامجين بالتواصل وتبادل البيانات تلقائياً",
    explanation: "تتيح واجهات برمجة التطبيقات (APIs) لتطبيقات بايثون استهلاك البيانات المفتوحة والخدمات السحابية عبر بروتوكولات الاتصال القياسية.",
    revisionPrompt: "راجعي درس 5-3 «البيانات المفتوحة وواجهات برمجة التطبيقات»، وافهمي آلية عمل الـ APIs.",
  },
  {
    id: "python-ml-split-01",
    chapter: "python",
    chapterTitle: "البيانات وبايثون والذكاء الاصطناعي",
    lessonTitle: "أساسيات التعلم الآلي",
    lessonNumber: "7-1",
    sourceFile: PART_TWO,
    bookPage: 50,
    question: "لماذا نقسم البيانات إلى مجموعة تدريب (Training) ومجموعة اختبار (Testing) في التعلم الآلي؟",
    choices: [
      "لقياس قدرة النموذج على التعميم على بيانات جديدة لم يسبق له رؤيتها",
      "لزيادة عدد الصفوف داخل قاعدة البيانات دون تدريب حقيقي",
      "لمنع النموذج من قراءة المتغيرات الرقمية",
      "لتحويل جميع الأرقام إلى نصوص تلقائيًا",
    ],
    answer: "لقياس قدرة النموذج على التعميم على بيانات جديدة لم يسبق له رؤيتها",
    explanation: "بيانات التدريب تساعد النموذج على استنتاج الأنماط، وبيانات الاختبار تقيس دقة وأداء النموذج على عينات جديدة لتجنب فرط التخصيص (Overfitting).",
    revisionPrompt: "راجعي درس 7-1 «أساسيات التعلم الآلي»، خاصة الفرق بين بيانات التدريب والاختبار.",
  },
  {
    id: "python-neural-network-03",
    chapter: "python",
    chapterTitle: "البيانات وبايثون والذكاء الاصطناعي",
    lessonTitle: "الشبكات العصبية والتعلم العميق",
    lessonNumber: "7-2",
    sourceFile: PART_TWO,
    bookPage: 60,
    question: "ما هي الطبقة الوسطى المسؤولة عن استخراج الأنماط المعقدة في الشبكات العصبية الاصطناعية؟",
    choices: [
      "الطبقات الخفية (Hidden Layers)",
      "طبقة الإدخال فقط (Input Layer)",
      "طبقة الإخراج النهائية (Output Layer)",
      "قاعدة البيانات المادية",
    ],
    answer: "الطبقات الخفية (Hidden Layers)",
    explanation: "تتكون الشبكات العصبية العميقة من طبقة إدخال وطبقات خفية (Hidden Layers) تقوم بالمعالجة واستخلاص الميزات، ثم طبقة الإخراج.",
    revisionPrompt: "راجعي درس 7-2 «الشبكات العصبية والتعلم العميق»، وتعرفي على بنية الطبقات في الشبكة العصبية.",
  },
];

export function getCurriculumQuestion(id: string): CurriculumQuestion | undefined {
  return CURRICULUM_QUESTIONS.find((question) => question.id === id);
}
