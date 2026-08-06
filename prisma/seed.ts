import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { normalizeEgyptPhone } from "../src/lib/phone";

type SeedCourseInput = {
  title: string;
  subject: string;
  description: string;
  educationalStage: string;
  thumbnailUrl: string;
  isPaid?: boolean;
  price?: number;
  contactPhone?: string;
  discountPercent?: number;
  discountExpiresAt?: Date;
  folders: Array<{
    name: string;
    videos: Array<{ title: string; vdoCipherId: string }>;
    quizzes: Array<{
      title: string;
      questions: Array<{
        question: string;
        optionA: string;
        optionB: string;
        optionC: string;
        optionD: string;
        correctAnswer: "A" | "B" | "C" | "D";
      }>;
    }>;
  }>;
};

// ─── Seed data ────────────────────────────────────────────────────────────────

const TEACHERS = [
  { name: "مستر أحمد محمود",   email: "teacher1.demo@platform.local" },
  { name: "مستر سامي الشاذلي", email: "teacher2.demo@platform.local" },
  { name: "مس نهى إبراهيم",    email: "teacher3.demo@platform.local" },
  { name: "مستر كريم حسين",    email: "teacher4.demo@platform.local" },
  { name: "مس فاطمة علي",      email: "teacher5.demo@platform.local" },
  { name: "مستر عمر طارق",     email: "teacher6.demo@platform.local" },
  { name: "مس منى الحسن",      email: "teacher7.demo@platform.local" },
];

const STUDENTS = [
  { name: "محمد حسام",          email: "student1.demo@platform.local",  stage: "prep_3", age: 15, phone: "01000000001" },
  { name: "أحمد إبراهيم",        email: "student2.demo@platform.local",  stage: "sec_1",  age: 16, phone: "01000000002" },
  { name: "فاطمة محمود",         email: "student3.demo@platform.local",  stage: "prep_3", age: 15, phone: "01000000003" },
  { name: "مريم عبدالله",        email: "student4.demo@platform.local",  stage: "sec_1",  age: 16, phone: "01000000004" },
  { name: "يوسف علي",           email: "student5.demo@platform.local",  stage: "sec_2",  age: 17, phone: "01000000005" },
  { name: "زياد أحمد",           email: "student6.demo@platform.local",  stage: "sec_1",  age: 16, phone: "01000000006" },
  { name: "نور الهدى محمد",      email: "student7.demo@platform.local",  stage: "prep_3", age: 14, phone: "01000000007" },
  { name: "سارة الحسن",          email: "student8.demo@platform.local",  stage: "sec_2",  age: 17, phone: "01000000008" },
  { name: "عمر خالد",            email: "student9.demo@platform.local",  stage: "sec_1",  age: 16, phone: "01000000009" },
  { name: "علي مصطفى",          email: "student10.demo@platform.local", stage: "sec_2",  age: 17, phone: "01000000010" },
  { name: "لمياء إبراهيم",       email: "student11.demo@platform.local", stage: "prep_3", age: 15, phone: "01100000001" },
  { name: "أنس محمد",            email: "student12.demo@platform.local", stage: "sec_1",  age: 16, phone: "01100000002" },
  { name: "ريم أحمد",            email: "student13.demo@platform.local", stage: "sec_2",  age: 17, phone: "01100000003" },
  { name: "مصطفى سعيد",         email: "student14.demo@platform.local", stage: "sec_1",  age: 16, phone: "01100000004" },
  { name: "دينا الشاذلي",        email: "student15.demo@platform.local", stage: "sec_2",  age: 17, phone: "01100000005" },
  { name: "خالد عمر",            email: "student16.demo@platform.local", stage: "prep_3", age: 14, phone: "01100000006" },
  { name: "منة الله محمود",      email: "student17.demo@platform.local", stage: "sec_1",  age: 16, phone: "01100000007" },
  { name: "إسلام حسن",           email: "student18.demo@platform.local", stage: "sec_2",  age: 17, phone: "01100000008" },
  { name: "آية الله عبدالرحمن",  email: "student19.demo@platform.local", stage: "prep_3", age: 15, phone: "01200000001" },
  { name: "كريم طارق",           email: "student20.demo@platform.local", stage: "sec_1",  age: 16, phone: "01200000002" },
];

async function saveCourse(teacherId: string, courseInput: SeedCourseInput) {
  const existing = await prisma.course.findFirst({
    where: {
      teacherId,
      title: courseInput.title,
    },
    select: { id: true },
  });

  const payload = {
    title: courseInput.title,
    subject: courseInput.subject,
    description: courseInput.description,
    educationalStage: courseInput.educationalStage,
    thumbnailUrl: courseInput.thumbnailUrl,
    isPaid: courseInput.isPaid ?? false,
    price: courseInput.price ?? null,
    contactPhone: courseInput.contactPhone ?? null,
    discountPercent: courseInput.discountPercent ?? null,
    discountExpiresAt: courseInput.discountExpiresAt ?? null,
    folders: {
      create: courseInput.folders.map((folder, folderIndex) => ({
        name: folder.name,
        order: folderIndex,
        videos: {
          create: folder.videos.map((video, videoIndex) => ({
            title: video.title,
            vdoCipherId: video.vdoCipherId,
            order: videoIndex,
          })),
        },
        quizzes: {
          create: folder.quizzes.map((quiz) => ({
            title: quiz.title,
            questions: {
              create: quiz.questions.map((question, questionIndex) => ({
                ...question,
                order: questionIndex,
              })),
            },
          })),
        },
      })),
    },
  };

  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: {
        ...payload,
        folders: {
          deleteMany: {},
          create: payload.folders.create,
        },
      },
    });
  }

  return prisma.course.create({
    data: {
      ...payload,
      teacherId,
    },
  });
}

async function main() {
  const teacherPass = await bcrypt.hash("teacher123", 10);
  const studentPass = await bcrypt.hash("student123", 10);

  // ── 0. Wipe existing courses (cascades folders/videos/quizzes/codes/progress) ──
  console.log("Deleting existing courses...");
  await prisma.course.deleteMany();

  // ── 1. Teachers ────────────────────────────────────────────────────────────
  console.log("Seeding teachers...");
  const teachers = await Promise.all(
    TEACHERS.map((t) =>
      prisma.user.upsert({
        where: { email: t.email },
        update: { name: t.name, password: teacherPass, role: "teacher" },
        create: { name: t.name, email: t.email, password: teacherPass, role: "teacher" },
      })
    )
  );
  const [t1, t2, t3, t4, t5, t6, t7] = teachers;

  // ── 2. Students ────────────────────────────────────────────────────────────
  console.log("Seeding students...");
  const students = await Promise.all(
    STUDENTS.map((s) => {
      const normalizedPhone = normalizeEgyptPhone(s.phone);
      return prisma.user.upsert({
        where: { email: s.email },
        update: { name: s.name, password: studentPass, role: "student", educationalStage: s.stage, age: s.age, phone: normalizedPhone, profileCompleted: true },
        create: { name: s.name, email: s.email, password: studentPass, role: "student", educationalStage: s.stage, age: s.age, phone: normalizedPhone, profileCompleted: true },
      });
    })
  );

  // ── 3. Courses ─────────────────────────────────────────────────────────────
  console.log("Seeding courses...");

  const course1 = await saveCourse(t1.id, {
    title: "تأسيس الجبر للصف الثالث الإعدادي",
    subject: "رياضيات", educationalStage: "prep_3",
    description: "شرح مبسط خطوة بخطوة للجبر مع تدريبات واختبارات قصيرة.",
    thumbnailUrl: "https://picsum.photos/seed/algebra/800/400",
    isPaid: true, price: 120, contactPhone: "01012345601",
    discountPercent: 100, discountExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    folders: [
      { name: "الحدود الجبرية", videos: [{ title: "مقدمة الحدود الجبرية", vdoCipherId: "alge-v1" }, { title: "عمليات على الحدود", vdoCipherId: "alge-v2" }],
        quizzes: [{ title: "اختبار الحدود", questions: [
          { question: "ناتج 3س + 5س يساوي؟", optionA: "8س", optionB: "15س", optionC: "2س", optionD: "س^8", correctAnswer: "A" },
          { question: "تحليل س² - 9 هو؟", optionA: "(س-9)(س+1)", optionB: "(س-3)(س+3)", optionC: "(س+9)(س-1)", optionD: "لا يُحلَّل", correctAnswer: "B" },
          { question: "مربع الثنائي (س+3)² يساوي؟", optionA: "س²+9", optionB: "س²+3س+9", optionC: "س²+6س+9", optionD: "س²+6س", correctAnswer: "C" },
        ]}] },
      { name: "المعادلات والمتراجحات", videos: [{ title: "حل المعادلة الخطية", vdoCipherId: "alge-v3" }, { title: "المتراجحات", vdoCipherId: "alge-v4" }],
        quizzes: [{ title: "اختبار المعادلات", questions: [
          { question: "حل المعادلة 2س + 4 = 10 هو؟", optionA: "س=2", optionB: "س=3", optionC: "س=4", optionD: "س=7", correctAnswer: "B" },
          { question: "إذا كان 3س > 9 فإن؟", optionA: "س > 3", optionB: "س < 3", optionC: "س = 3", optionD: "س > 6", correctAnswer: "A" },
        ]}] },
    ],
  });

  const course2 = await saveCourse(t2.id, {
    title: "فيزياء الحركة للصف الأول الثانوي",
    subject: "فيزياء", educationalStage: "sec_1",
    description: "أساسيات الحركة والسرعة والتسارع مع مسائل محلولة بالتفصيل.",
    thumbnailUrl: "https://picsum.photos/seed/physics/800/400",
    isPaid: true, price: 150, contactPhone: "01098765432",
    discountPercent: 30, discountExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    folders: [
      { name: "مفاهيم الحركة", videos: [{ title: "المسافة والإزاحة", vdoCipherId: "phys-v1" }, { title: "السرعة المتوسطة", vdoCipherId: "phys-v2" }],
        quizzes: [{ title: "اختبار الحركة", questions: [
          { question: "وحدة قياس السرعة هي؟", optionA: "متر", optionB: "م/ث", optionC: "ثانية", optionD: "نيوتن", correctAnswer: "B" },
          { question: "جسم يتحرك 60م في 3 ثوانٍ، سرعته؟", optionA: "10 م/ث", optionB: "15 م/ث", optionC: "20 م/ث", optionD: "30 م/ث", correctAnswer: "C" },
          { question: "الإزاحة كمية...؟", optionA: "قياسية", optionB: "متجهة", optionC: "ثابتة", optionD: "نسبية", correctAnswer: "B" },
        ]}] },
      { name: "قوانين نيوتن", videos: [{ title: "القانون الأول لنيوتن", vdoCipherId: "phys-v3" }, { title: "القانون الثاني والثالث", vdoCipherId: "phys-v4" }],
        quizzes: [{ title: "اختبار نيوتن", questions: [
          { question: "القانون الأول لنيوتن يُعرف بقانون؟", optionA: "الجاذبية", optionB: "القصور الذاتي", optionC: "التسارع", optionD: "الفعل ورد الفعل", correctAnswer: "B" },
          { question: "ق = ك × ت، وحدة القوة هي؟", optionA: "جول", optionB: "واط", optionC: "نيوتن", optionD: "باسكال", correctAnswer: "C" },
        ]}] },
    ],
  });

  const course3 = await saveCourse(t3.id, {
    title: "النحو والصرف للصف الأول الثانوي",
    subject: "لغة عربية", educationalStage: "sec_1",
    description: "قواعد اللغة العربية من نحو وصرف بأسلوب واضح ومبسط.",
    thumbnailUrl: "https://picsum.photos/seed/arabic/800/400",
    folders: [
      { name: "المبتدأ والخبر", videos: [{ title: "تعريف المبتدأ والخبر", vdoCipherId: "arab-v1" }, { title: "أنواع الخبر", vdoCipherId: "arab-v2" }],
        quizzes: [{ title: "اختبار المبتدأ والخبر", questions: [
          { question: "المبتدأ يكون مرفوعاً دائماً؟", optionA: "صح", optionB: "خطأ", optionC: "أحياناً", optionD: "نادراً", correctAnswer: "A" },
          { question: "في جملة 'العلم نور'، كلمة 'نور' هي؟", optionA: "مبتدأ", optionB: "خبر", optionC: "فاعل", optionD: "مفعول به", correctAnswer: "B" },
          { question: "الخبر الجملة الفعلية في: 'الطالبُ يذاكرُ'؟", optionA: "الطالب", optionB: "يذاكر", optionC: "ال", optionD: "لا خبر", correctAnswer: "B" },
        ]}] },
      { name: "الفعل والفاعل", videos: [{ title: "أنواع الأفعال", vdoCipherId: "arab-v3" }, { title: "الفاعل ونائب الفاعل", vdoCipherId: "arab-v4" }],
        quizzes: [{ title: "اختبار الفعل والفاعل", questions: [
          { question: "الفاعل يكون في محل رفع؟", optionA: "خطأ", optionB: "صح", optionC: "أحياناً", optionD: "غير محدد", correctAnswer: "B" },
          { question: "الفعل المضارع يبدأ بأحد حروف؟", optionA: "ب-ت-ث-ج", optionB: "أ-ن-ت-ي", optionC: "ك-ل-م-ن", optionD: "س-ش-ص-ض", correctAnswer: "B" },
        ]}] },
    ],
  });

  const course4 = await saveCourse(t4.id, {
    title: "الكيمياء العضوية للصف الثاني الثانوي",
    subject: "كيمياء", educationalStage: "sec_2",
    description: "مفاهيم الكيمياء العضوية والهيدروكربونات بشرح وافٍ وأمثلة عملية.",
    thumbnailUrl: "https://picsum.photos/seed/chemistry/800/400",
    isPaid: true, price: 200, contactPhone: "01155556677",
    discountPercent: 50, discountExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    folders: [
      { name: "الهيدروكربونات", videos: [{ title: "الألكانات والألكينات", vdoCipherId: "chem-v1" }, { title: "الألكاينات والبنزين", vdoCipherId: "chem-v2" }],
        quizzes: [{ title: "اختبار الهيدروكربونات", questions: [
          { question: "الصيغة العامة للألكانات هي؟", optionA: "CₙH₂ₙ", optionB: "CₙH₂ₙ₊₂", optionC: "CₙH₂ₙ₋₂", optionD: "CₙHₙ", correctAnswer: "B" },
          { question: "الإيثين يحتوي على رابطة؟", optionA: "أحادية", optionB: "ثنائية", optionC: "ثلاثية", optionD: "تساهمية تناسقية", correctAnswer: "B" },
          { question: "عدد ذرات الكربون في الميثان؟", optionA: "1", optionB: "2", optionC: "3", optionD: "4", correctAnswer: "A" },
        ]}] },
      { name: "التفاعلات العضوية", videos: [{ title: "تفاعلات الإضافة", vdoCipherId: "chem-v3" }, { title: "التفاعلات الاستبدالية", vdoCipherId: "chem-v4" }],
        quizzes: [{ title: "اختبار التفاعلات", questions: [
          { question: "تفاعل الألكينات مع البروم يُسمى؟", optionA: "استبدال", optionB: "إضافة", optionC: "أكسدة", optionD: "تكثيف", correctAnswer: "B" },
          { question: "ناتج حرق الميثان كاملاً؟", optionA: "CO فقط", optionB: "CO₂ + H₂O", optionC: "C + H₂O", optionD: "CO₂ فقط", correctAnswer: "B" },
        ]}] },
    ],
  });

  const course5 = await saveCourse(t5.id, {
    title: "علم الأحياء - الخلية والوراثة",
    subject: "أحياء", educationalStage: "sec_2",
    description: "دراسة الخلية الحية وأسس علم الوراثة المندلية والجزيئية.",
    thumbnailUrl: "https://picsum.photos/seed/biology/800/400",
    folders: [
      { name: "بناء الخلية", videos: [{ title: "أجزاء الخلية ووظائفها", vdoCipherId: "biol-v1" }, { title: "الغشاء الخلوي", vdoCipherId: "biol-v2" }],
        quizzes: [{ title: "اختبار الخلية", questions: [
          { question: "العضية المسؤولة عن التنفس الخلوي؟", optionA: "النواة", optionB: "الميتوكوندريا", optionC: "الريبوسوم", optionD: "جهاز جولجي", correctAnswer: "B" },
          { question: "الغشاء الخلوي مكوّن أساساً من؟", optionA: "البروتين فقط", optionB: "الدهون فقط", optionC: "طبقة مزدوجة من الدهون والبروتين", optionD: "الكربوهيدرات", correctAnswer: "C" },
          { question: "الـ DNA موجود في؟", optionA: "الغشاء الخلوي", optionB: "النواة", optionC: "الميتوكوندريا فقط", optionD: "الريبوسوم", correctAnswer: "B" },
        ]}] },
      { name: "الوراثة المندلية", videos: [{ title: "قوانين مندل", vdoCipherId: "biol-v3" }, { title: "الصفات الوراثية", vdoCipherId: "biol-v4" }],
        quizzes: [{ title: "اختبار الوراثة", questions: [
          { question: "الجين السائد يُرمز له بـ؟", optionA: "حرف صغير", optionB: "حرف كبير", optionC: "رقم", optionD: "رمز", correctAnswer: "B" },
          { question: "نتيجة تهجين AA × aa تعطي نسبة؟", optionA: "50% Aa", optionB: "100% AA", optionC: "100% Aa", optionD: "50% AA + 50% aa", correctAnswer: "C" },
        ]}] },
    ],
  });

  const course6 = await saveCourse(t6.id, {
    title: "تاريخ مصر الحديث والمعاصر",
    subject: "تاريخ", educationalStage: "sec_1",
    description: "تاريخ مصر من الحملة الفرنسية حتى الجمهورية بأسلوب قصصي شيق.",
    thumbnailUrl: "https://picsum.photos/seed/history/800/400",
    isPaid: true, price: 100, contactPhone: "01233334455",
    folders: [
      { name: "مصر في القرن التاسع عشر", videos: [{ title: "الحملة الفرنسية وآثارها", vdoCipherId: "hist-v1" }, { title: "محمد علي وبناء الدولة", vdoCipherId: "hist-v2" }],
        quizzes: [{ title: "اختبار القرن التاسع عشر", questions: [
          { question: "قائد الحملة الفرنسية على مصر؟", optionA: "نابليون بونابرت", optionB: "لويس الرابع عشر", optionC: "نيلسون", optionD: "كليبر", correctAnswer: "A" },
          { question: "معركة أبي قير البحرية انتصر فيها؟", optionA: "الفرنسيون", optionB: "المصريون", optionC: "الإنجليز", optionD: "العثمانيون", correctAnswer: "C" },
          { question: "أنشأ محمد علي مدرسة الطب في؟", optionA: "الإسكندرية", optionB: "قصر العيني", optionC: "الأزهر", optionD: "أسيوط", correctAnswer: "B" },
        ]}] },
      { name: "الثورة والاستقلال", videos: [{ title: "ثورة 1919", vdoCipherId: "hist-v3" }, { title: "ثورة 1952", vdoCipherId: "hist-v4" }],
        quizzes: [{ title: "اختبار الثورات", questions: [
          { question: "قائد ثورة 1919؟", optionA: "مصطفى كامل", optionB: "سعد زغلول", optionC: "محمد فريد", optionD: "أحمد عرابي", correctAnswer: "B" },
          { question: "قامت ثورة يوليو 1952 في؟", optionA: "23 يوليو", optionB: "26 يوليو", optionC: "19 يوليو", optionD: "30 يوليو", correctAnswer: "A" },
        ]}] },
    ],
  });

  const course7 = await saveCourse(t7.id, {
    title: "English Grammar for Secondary - Level 2",
    subject: "لغة إنجليزية", educationalStage: "sec_2",
    description: "Comprehensive English grammar course covering tenses, conditionals, and advanced structures.",
    thumbnailUrl: "https://picsum.photos/seed/english/800/400",
    isPaid: true, price: 175, contactPhone: "01066667788",
    folders: [
      { name: "Tenses & Aspects", videos: [{ title: "Present Perfect vs Past Simple", vdoCipherId: "engl-v1" }, { title: "Future Forms", vdoCipherId: "engl-v2" }],
        quizzes: [{ title: "Tenses Quiz", questions: [
          { question: "Choose the correct tense: 'She ___ in Cairo since 2020.'", optionA: "lives", optionB: "has lived", optionC: "lived", optionD: "is living", correctAnswer: "B" },
          { question: "Which is correct for a future plan?", optionA: "I will go", optionB: "I am going to go", optionC: "I went", optionD: "I had gone", correctAnswer: "B" },
          { question: "Passive voice of 'They built the bridge'?", optionA: "The bridge is built", optionB: "The bridge was built", optionC: "The bridge has been built", optionD: "The bridge will be built", correctAnswer: "B" },
        ]}] },
      { name: "Conditionals & Modals", videos: [{ title: "Zero and First Conditional", vdoCipherId: "engl-v3" }, { title: "Second and Third Conditional", vdoCipherId: "engl-v4" }],
        quizzes: [{ title: "Conditionals Quiz", questions: [
          { question: "Type 1 conditional: 'If it rains, I ___ stay home.'", optionA: "would", optionB: "will", optionC: "had", optionD: "should", correctAnswer: "B" },
          { question: "Type 2 conditional uses which tense in the if-clause?", optionA: "Past simple", optionB: "Present simple", optionC: "Past perfect", optionD: "Future", correctAnswer: "A" },
        ]}] },
    ],
  });

  const course8 = await saveCourse(t1.id, {
    title: "رياضيات الصف الثاني الثانوي",
    subject: "رياضيات", educationalStage: "sec_2",
    description: "المثلثات والدوال وحساب المثلثات والتفاضل المبسط.",
    thumbnailUrl: "https://picsum.photos/seed/geometry/800/400",
    isPaid: true, price: 130, contactPhone: "01012345601",
    folders: [
      { name: "حساب المثلثات", videos: [{ title: "الزوايا والمثلثات", vdoCipherId: "math2-v1" }, { title: "النسب المثلثية", vdoCipherId: "math2-v2" }],
        quizzes: [{ title: "اختبار المثلثات", questions: [
          { question: "sin 90° يساوي؟", optionA: "0", optionB: "1", optionC: "-1", optionD: "½", correctAnswer: "B" },
          { question: "cos 0° يساوي؟", optionA: "0", optionB: "-1", optionC: "1", optionD: "√2/2", correctAnswer: "C" },
          { question: "tan 45° يساوي؟", optionA: "0", optionB: "√3", optionC: "½", optionD: "1", correctAnswer: "D" },
        ]}] },
      { name: "التفاضل والتكامل", videos: [{ title: "مفهوم المشتقة", vdoCipherId: "math2-v3" }, { title: "قواعد التفاضل", vdoCipherId: "math2-v4" }],
        quizzes: [{ title: "اختبار التفاضل", questions: [
          { question: "مشتقة الثابت تساوي؟", optionA: "الثابت نفسه", optionB: "1", optionC: "0", optionD: "غير محددة", correctAnswer: "C" },
          { question: "مشتقة س³ تساوي؟", optionA: "3س", optionB: "3س²", optionC: "س²", optionD: "2س³", correctAnswer: "B" },
        ]}] },
    ],
  });

  const course9 = await saveCourse(t2.id, {
    title: "الفيزياء والطاقة للصف الثالث الثانوي",
    subject: "فيزياء", educationalStage: "sec_3",
    description: "الطاقة وأشكالها وتحولاتها والفيزياء الحديثة بأسلوب تحليلي.",
    thumbnailUrl: "https://picsum.photos/seed/energy/800/400",
    isPaid: true, price: 180, contactPhone: "01098765432",
    folders: [
      { name: "أشكال الطاقة", videos: [{ title: "الطاقة الحركية والكامنة", vdoCipherId: "phys2-v1" }, { title: "الطاقة الكهربائية", vdoCipherId: "phys2-v2" }],
        quizzes: [{ title: "اختبار الطاقة", questions: [
          { question: "الطاقة الحركية تساوي؟", optionA: "mgh", optionB: "½mv²", optionC: "mv", optionD: "ma", correctAnswer: "B" },
          { question: "وحدة قياس الطاقة؟", optionA: "نيوتن", optionB: "واط", optionC: "جول", optionD: "باسكال", correctAnswer: "C" },
          { question: "قانون حفظ الطاقة ينص على أن الطاقة؟", optionA: "تُخلق من العدم", optionB: "تتحول ولا تفنى", optionC: "تفنى دائماً", optionD: "ثابتة في جميع الحالات", correctAnswer: "B" },
        ]}] },
      { name: "الفيزياء الحديثة", videos: [{ title: "الإشعاع والنظائر", vdoCipherId: "phys2-v3" }, { title: "فيزياء الكم", vdoCipherId: "phys2-v4" }],
        quizzes: [{ title: "اختبار الفيزياء الحديثة", questions: [
          { question: "اكتشف النيوترون العالم؟", optionA: "رذرفورد", optionB: "تشادويك", optionC: "بور", optionD: "أينشتاين", correctAnswer: "B" },
          { question: "نصف عمر النظير المشع هو الزمن اللازم لـ؟", optionA: "تحلل كامل العينة", optionB: "تحلل نصف العينة", optionC: "مضاعفة العينة", optionD: "استقرار العينة", correctAnswer: "B" },
        ]}] },
    ],
  });

  const course10 = await saveCourse(t3.id, {
    title: "الأدب العربي في العصر الحديث",
    subject: "لغة عربية", educationalStage: "sec_2",
    description: "دراسة الشعر والنثر في العصر الحديث مع أبرز الأدباء والتيارات.",
    thumbnailUrl: "https://picsum.photos/seed/literature/800/400",
    folders: [
      { name: "الشعر الحديث", videos: [{ title: "مدارس الشعر الحديث", vdoCipherId: "lit-v1" }, { title: "أبرز شعراء النهضة", vdoCipherId: "lit-v2" }],
        quizzes: [{ title: "اختبار الشعر الحديث", questions: [
          { question: "رائد الشعر المرسل في مصر؟", optionA: "أحمد شوقي", optionB: "أمير الشعراء", optionC: "نازك الملائكة", optionD: "حافظ إبراهيم", correctAnswer: "A" },
          { question: "لقب أحمد شوقي؟", optionA: "شاعر النيل", optionB: "أمير الشعراء", optionC: "شاعر القطرين", optionD: "شاعر العروبة", correctAnswer: "B" },
          { question: "ديوان 'وحي الرسالة' لـ؟", optionA: "العقاد", optionB: "المازني", optionC: "طه حسين", optionD: "المنفلوطي", correctAnswer: "A" },
        ]}] },
      { name: "النثر الحديث", videos: [{ title: "فن المقالة", vdoCipherId: "lit-v3" }, { title: "الرواية العربية الحديثة", vdoCipherId: "lit-v4" }],
        quizzes: [{ title: "اختبار النثر", questions: [
          { question: "رائد الرواية العربية الحديثة؟", optionA: "طه حسين", optionB: "نجيب محفوظ", optionC: "يوسف إدريس", optionD: "توفيق الحكيم", correctAnswer: "B" },
          { question: "نجيب محفوظ حصل على جائزة نوبل عام؟", optionA: "1978", optionB: "1984", optionC: "1988", optionD: "1992", correctAnswer: "C" },
        ]}] },
    ],
  });

  const courses = [course1, course2, course3, course4, course5, course6, course7, course8, course9, course10];
  const prefixes = ["ALGE", "PHYS", "ARAB", "CHEM", "BIOL", "HIST", "ENGL", "MTH2", "NUCL", "LITR"];

  // ── 4. Access codes ────────────────────────────────────────────────────────
  console.log("Seeding access codes...");

  // Enrollment map: courseIndex → studentIndexes that should be enrolled
  const enrollments: Record<number, number[]> = {
    0: [0, 2, 6, 10, 15, 18],       // Algebra       → 6 students
    1: [1, 3, 5, 8, 11, 16],        // Physics        → 6 students
    2: [1, 3, 5, 8, 11, 13, 16, 19],// Arabic         → 8 students
    3: [4, 7, 9, 12, 14, 17],       // Chemistry      → 6 students
    4: [4, 7, 9, 12, 14, 17],       // Biology        → 6 students
    5: [1, 3, 5, 8, 11, 13, 16, 19],// History        → 8 students
    6: [4, 7, 9, 12, 14, 17],       // English        → 6 students
    7: [4, 7, 9, 12, 14, 17],       // Math sec_2     → 6 students
    8: [],                           // Nuclear (no enrollments yet — unused codes)
    9: [4, 7, 9, 12, 14, 17],       // Arabic Lit     → 6 students
  };

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    const prefix = prefixes[ci];
    const enrolled = enrollments[ci] ?? [];

    for (let i = 0; i < enrolled.length + 2; i++) {
      const code = `${prefix}${String(i + 1).padStart(3, "0")}`;
      const studentId = i < enrolled.length ? students[enrolled[i]].id : null;
      await prisma.accessCode.upsert({
        where: { code },
        update: { courseId: course.id, studentId, usedAt: studentId ? new Date() : null, isActive: true },
        create: { code, courseId: course.id, studentId, usedAt: studentId ? new Date() : null, isActive: true },
      });
    }
  }

  // ── 5. Quiz results ────────────────────────────────────────────────────────
  console.log("Seeding quiz results...");

  // Collect all quiz IDs per course
  const courseQuizzes = await Promise.all(
    courses.map((c) =>
      prisma.quiz.findMany({
        where: { folder: { courseId: c.id } },
        select: { id: true },
      })
    )
  );

  const resultData: { studentId: string; quizId: string; score: number; totalQ: number }[] = [];
  const scores = [85, 70, 90, 60, 75, 95, 55, 80, 65, 100, 72, 88, 50, 93, 78];

  for (let ci = 0; ci < courses.length; ci++) {
    const enrolled = enrollments[ci] ?? [];
    const quizzes = courseQuizzes[ci];
    quizzes.forEach((quiz, qi) => {
      enrolled.slice(0, 4).forEach((si, idx) => {
        resultData.push({
          studentId: students[si].id,
          quizId: quiz.id,
          score: scores[(ci + qi + idx) % scores.length],
          totalQ: 3,
        });
      });
    });
  }

  for (const r of resultData) {
    await prisma.quizResult.upsert({
      where: { studentId_quizId: { studentId: r.studentId, quizId: r.quizId } },
      update: { score: r.score, totalQ: r.totalQ },
      create: { studentId: r.studentId, quizId: r.quizId, score: r.score, totalQ: r.totalQ },
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEACHERS (password: teacher123)");
  TEACHERS.forEach((t) => console.log(`  ${t.email}`));
  console.log("\nSTUDENTS (password: student123)");
  STUDENTS.forEach((s) => console.log(`  ${s.email}`));
  console.log("\nSAMPLE ACCESS CODES (unused)");
  prefixes.forEach((p, i) => console.log(`  Course ${i + 1}: ${p}${String((enrollments[i]?.length ?? 0) + 1).padStart(3, "0")}`));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
