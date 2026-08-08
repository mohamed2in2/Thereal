import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-auth";
import { resetDemoTeacherIdCache } from "@/lib/demo";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const demoTeacher = await prisma.user.findFirst({
      where: { isDemo: true, role: "teacher" },
      include: {
        teacherProfile: true,
        courses: {
          include: {
            folders: {
              include: {
                videos: true,
                homeworks: true,
                quizzes: true,
              },
            },
          },
        },
      },
    });

    const demoStudentsCount = await prisma.user.count({
      where: { isDemo: true, role: "student" },
    });

    return NextResponse.json({
      seeded: !!demoTeacher,
      demoTeacher,
      demoStudentsCount,
    });
  } catch (error) {
    console.error("Demo status error:", error);
    return NextResponse.json({ error: "فشل استعلام حالة المعلم التجريبي" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const existingNonDemo = await prisma.user.findFirst({
      where: { name: "test", role: "teacher", isDemo: false },
    });

    if (existingNonDemo) {
      return NextResponse.json(
        { error: "يوجد حساب معلم حقيقي غير تجريبي بنفس اسم الدخول test" },
        { status: 400 }
      );
    }

    const rawPassword = process.env.DEMO_TEACHER_PASSWORD ?? "Admin123";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 1. Upsert Teacher
    const teacher = await prisma.user.upsert({
      where: { email: "demo_teacher@test.local" },
      update: {
        name: "test",
        password: passwordHash,
        role: "teacher",
        isDemo: true,
        isActive: true,
        isDeleted: false,
      },
      create: {
        name: "test",
        email: "demo_teacher@test.local",
        phone: "01000000099",
        password: passwordHash,
        role: "teacher",
        isDemo: true,
        isActive: true,
        isDeleted: false,
      },
    });

    // 2. Upsert Teacher Profile
    await prisma.teacherProfile.upsert({
      where: { teacherId: teacher.id },
      update: {
        displayName: "المدرس التجريبي (DEMO)",
        slug: "demo",
        bio: "صفحة أستاذ الشرح التجريبي لعرض واستعراض كافة مزايا وإمكانيات المنصة للإدارة والمشرفين فقط.",
        isPublished: true,
        priceMonthly: 200,
        priceTermly: 500,
        priceYearly: 1200,
        accentColor: "#f59e0b",
        navColor: "#1e1b4b",
      },
      create: {
        teacherId: teacher.id,
        displayName: "المدرس التجريبي (DEMO)",
        slug: "demo",
        bio: "صفحة أستاذ الشرح التجريبي لعرض واستعراض كافة مزايا وإمكانيات المنصة للإدارة والمشرفين فقط.",
        isPublished: true,
        priceMonthly: 200,
        priceTermly: 500,
        priceYearly: 1200,
        accentColor: "#f59e0b",
        navColor: "#1e1b4b",
      },
    });

    // 3. Upsert Courses
    const courseFree = await prisma.course.upsert({
      where: { id: "demo-course-free" },
      update: {
        title: "المقدمة المجانية في البرمجة والتفكير المنطقي (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_1",
        description: "كورس مجاني بالكامل يستعرض أساسيات التفكير المنطقي ولغات البرمجة.",
        isPaid: false,
        price: 0,
        teacherId: teacher.id,
      },
      create: {
        id: "demo-course-free",
        title: "المقدمة المجانية في البرمجة والتفكير المنطقي (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_1",
        description: "كورس مجاني بالكامل يستعرض أساسيات التفكير المنطقي ولغات البرمجة.",
        isPaid: false,
        price: 0,
        teacherId: teacher.id,
      },
    });

    const coursePaid = await prisma.course.upsert({
      where: { id: "demo-course-paid" },
      update: {
        title: "أساسيات خوارزميات وهياكل البيانات - الترم الأول (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_1",
        description: "كورس مدفوع شاملاً بالشروح والواجبات والاختبارات التفاعلية.",
        isPaid: true,
        price: 250,
        teacherId: teacher.id,
      },
      create: {
        id: "demo-course-paid",
        title: "أساسيات خوارزميات وهياكل البيانات - الترم الأول (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_1",
        description: "كورس مدفوع شاملاً بالشروح والواجبات والاختبارات التفاعلية.",
        isPaid: true,
        price: 250,
        teacherId: teacher.id,
      },
    });

    const discountExpiry = new Date();
    discountExpiry.setDate(discountExpiry.getDate() + 30);
    await prisma.course.upsert({
      where: { id: "demo-course-discount" },
      update: {
        title: "تطوير تطبيقات الويب المتكاملة - المستوى المتقدم (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_2",
        description: "كورس مدفوع خصم خاص للفترة المحدودة.",
        isPaid: true,
        price: 400,
        discountPercent: 25,
        discountExpiresAt: discountExpiry,
        teacherId: teacher.id,
      },
      create: {
        id: "demo-course-discount",
        title: "تطوير تطبيقات الويب المتكاملة - المستوى المتقدم (DEMO)",
        subject: "برمجة وحاسب آلي",
        educationalStage: "sec_2",
        description: "كورس مدفوع خصم خاص للفترة المحدودة.",
        isPaid: true,
        price: 400,
        discountPercent: 25,
        discountExpiresAt: discountExpiry,
        teacherId: teacher.id,
      },
    });

    // 4. Folders
    const folderFree = await prisma.folder.upsert({
      where: { id: "demo-folder-free" },
      update: {
        name: "المحاضرة الأولى: مقدمة البيئة البرمجية (مجانية)",
        courseId: coursePaid.id,
        order: 1,
        price: 0,
        isPurchasable: true,
      },
      create: {
        id: "demo-folder-free",
        name: "المحاضرة الأولى: مقدمة البيئة البرمجية (مجانية)",
        courseId: coursePaid.id,
        order: 1,
        price: 0,
        isPurchasable: true,
      },
    });

    const folderPurchasable = await prisma.folder.upsert({
      where: { id: "demo-folder-purchasable" },
      update: {
        name: "المحاضرة الثانية: التعمق في مصفوفات القوائم (تباع منفردة)",
        courseId: coursePaid.id,
        order: 2,
        price: 80,
        isPurchasable: true,
      },
      create: {
        id: "demo-folder-purchasable",
        name: "المحاضرة الثانية: التعمق في مصفوفات القوائم (تباع منفردة)",
        courseId: coursePaid.id,
        order: 2,
        price: 80,
        isPurchasable: true,
      },
    });

    // 5. Videos
    await prisma.video.upsert({
      where: { id: "demo-video-free" },
      update: {
        title: "درس 1: كود الشرح المجاني والتنفيذ الحي",
        folderId: folderFree.id,
        videoProvider: "youtube",
        providerVideoId: "dQw4w9WgXcQ",
        durationMinutes: 25,
        isFree: true,
        order: 1,
      },
      create: {
        id: "demo-video-free",
        title: "درس 1: كود الشرح المجاني والتنفيذ الحي",
        folderId: folderFree.id,
        videoProvider: "youtube",
        providerVideoId: "dQw4w9WgXcQ",
        durationMinutes: 25,
        isFree: true,
        order: 1,
      },
    });

    const videoPaid = await prisma.video.upsert({
      where: { id: "demo-video-paid" },
      update: {
        title: "درس 2: تحليل التعقيد الزمني والمكاني Big-O",
        folderId: folderFree.id,
        videoProvider: "youtube",
        providerVideoId: "dQw4w9WgXcQ",
        durationMinutes: 45,
        isFree: false,
        order: 2,
      },
      create: {
        id: "demo-video-paid",
        title: "درس 2: تحليل التعقيد الزمني والمكاني Big-O",
        folderId: folderFree.id,
        videoProvider: "youtube",
        providerVideoId: "dQw4w9WgXcQ",
        durationMinutes: 45,
        isFree: false,
        order: 2,
      },
    });

    await prisma.video.upsert({
      where: { id: "demo-video-native" },
      update: {
        title: "درس 3: رفع المحتوى المباشر بالسيرفر المحترس (Direct Upload)",
        folderId: folderPurchasable.id,
        videoProvider: "native",
        providerVideoId: "local_demo_sample.mp4",
        durationMinutes: 30,
        isFree: false,
        order: 1,
      },
      create: {
        id: "demo-video-native",
        title: "درس 3: رفع المحتوى المباشر بالسيرفر المحترس (Direct Upload)",
        folderId: folderPurchasable.id,
        videoProvider: "native",
        providerVideoId: "local_demo_sample.mp4",
        durationMinutes: 30,
        isFree: false,
        order: 1,
      },
    });

    // 6. Homework & Quizzes
    const homework = await prisma.homework.upsert({
      where: { id: "demo-homework-1" },
      update: {
        title: "واجب الخوارزميات التطبيقي الأول",
        type: "ESSAY",
        teacherId: teacher.id,
        courseId: coursePaid.id,
        folderId: folderFree.id,
      },
      create: {
        id: "demo-homework-1",
        title: "واجب الخوارزميات التطبيقي الأول",
        type: "ESSAY",
        teacherId: teacher.id,
        courseId: coursePaid.id,
        folderId: folderFree.id,
      },
    });

    const quiz = await prisma.quiz.upsert({
      where: { id: "demo-quiz-1" },
      update: {
        title: "اختبار قياس المفاهيم الأساسية",
        folderId: folderFree.id,
        timeLimitMinutes: 15,
      },
      create: {
        id: "demo-quiz-1",
        title: "اختبار قياس المفاهيم الأساسية",
        folderId: folderFree.id,
        timeLimitMinutes: 15,
      },
    });

    await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
    await prisma.quizQuestion.createMany({
      data: [
        {
          quizId: quiz.id,
          question: "ما هو التعقيد الزمني الخطي لترتيب المصفوفة الفردية؟",
          optionA: "O(1)",
          optionB: "O(N)",
          optionC: "O(N^2)",
          optionD: "O(log N)",
          correctAnswer: "optionB",
          order: 1,
        },
        {
          quizId: quiz.id,
          question: "أي من الهياكل التالية يعتمد مبدأ LIFO؟",
          optionA: "Queue",
          optionB: "Stack",
          optionC: "Array",
          optionD: "Tree",
          correctAnswer: "optionB",
          order: 2,
        },
      ],
    });

    // 7. Fake Students
    const studentUsers = [];
    for (let i = 1; i <= 6; i++) {
      const student = await prisma.user.upsert({
        where: { email: `demo_student_${i}@test.local` },
        update: {
          name: `طالب تجريبي ${i}`,
          phone: `0109999000${i}`,
          parentPhone: `0108888000${i}`,
          role: "student",
          isDemo: true,
          educationalStage: "sec_1",
          points: 50 * i,
        },
        create: {
          email: `demo_student_${i}@test.local`,
          name: `طالب تجريبي ${i}`,
          phone: `0109999000${i}`,
          parentPhone: `0108888000${i}`,
          role: "student",
          isDemo: true,
          educationalStage: "sec_1",
          points: 50 * i,
        },
      });
      studentUsers.push(student);
    }

    // 8. Access Codes & Purchases
    await prisma.accessCode.upsert({
      where: { code: "DEMO-COURSE-101" },
      update: {
        courseId: coursePaid.id,
        accessType: "TERM",
        studentId: studentUsers[0].id,
        isActive: true,
        usedAt: new Date(),
      },
      create: {
        code: "DEMO-COURSE-101",
        courseId: coursePaid.id,
        accessType: "TERM",
        studentId: studentUsers[0].id,
        isActive: true,
        usedAt: new Date(),
      },
    });

    await prisma.accessCode.upsert({
      where: { code: "DEMO-FOLDER-202" },
      update: {
        courseId: coursePaid.id,
        folderId: folderPurchasable.id,
        accessType: "FOLDER",
        studentId: null,
        isActive: true,
      },
      create: {
        code: "DEMO-FOLDER-202",
        courseId: coursePaid.id,
        folderId: folderPurchasable.id,
        accessType: "FOLDER",
        studentId: null,
        isActive: true,
      },
    });

    await prisma.folderPurchase.upsert({
      where: { studentId_folderId: { studentId: studentUsers[1].id, folderId: folderPurchasable.id } },
      update: { price: 80 },
      create: { studentId: studentUsers[1].id, folderId: folderPurchasable.id, price: 80 },
    });

    await prisma.videoPurchase.upsert({
      where: { studentId_videoId: { studentId: studentUsers[2].id, videoId: videoPaid.id } },
      update: { price: 50 },
      create: { studentId: studentUsers[2].id, videoId: videoPaid.id, price: 50 },
    });

    // 9. Teacher Subscriptions
    await prisma.teacherSubscription.deleteMany({ where: { teacherId: teacher.id } });
    await prisma.teacherSubscription.createMany({
      data: [
        {
          teacherId: teacher.id,
          studentId: studentUsers[0].id,
          planType: "monthly",
          planLabel: "اشتراك شهري",
          status: "active",
          amount: 200,
          educationalStage: "sec_1",
        },
        {
          teacherId: teacher.id,
          studentId: studentUsers[1].id,
          planType: "termly",
          planLabel: "اشتراك ترمي",
          status: "active",
          amount: 500,
          educationalStage: "sec_1",
        },
        {
          teacherId: teacher.id,
          studentId: studentUsers[2].id,
          planType: "yearly",
          planLabel: "اشتراك سنوي",
          status: "active",
          amount: 1200,
          educationalStage: "sec_1",
        },
      ],
    });

    // 10. Homework Submission & Quiz Result
    await prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId: homework.id, studentId: studentUsers[0].id } },
      update: { submittedOutput: "إجابة الطالب التجريبي الأول النموذجية على السؤال الأول والثاني.", status: "passed", score: 95, totalQ: 2 },
      create: { homeworkId: homework.id, studentId: studentUsers[0].id, submittedOutput: "إجابة الطالب التجريبي الأول النموذجية على السؤال الأول والثاني.", status: "passed", score: 95, totalQ: 2 },
    });

    await prisma.quizResult.upsert({
      where: { studentId_quizId: { studentId: studentUsers[0].id, quizId: quiz.id } },
      update: { score: 100, totalQ: 2 },
      create: { quizId: quiz.id, studentId: studentUsers[0].id, score: 100, totalQ: 2 },
    });

    // 11. Parent Token
    await prisma.parentToken.upsert({
      where: { studentId: studentUsers[0].id },
      update: { token: "demo-parent-token-12345" },
      create: { studentId: studentUsers[0].id, token: "demo-parent-token-12345" },
    });

    resetDemoTeacherIdCache();

    await logAdminAction({
      adminId: session.id,
      adminName: session.name,
      action: "SUPERADMIN_ACTION",
      targetType: "system",
      targetId: "demo-teacher",
      targetName: "المعلم التجريبي",
    });

    return NextResponse.json({
      success: true,
      teacherId: teacher.id,
      slug: "demo",
      loginName: "test",
      studentsCount: studentUsers.length,
    });
  } catch (error) {
    console.error("Demo seeding error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء بيانات المعلم التجريبي" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const demoTeacher = await prisma.user.findFirst({
      where: { isDemo: true, role: "teacher" },
      select: { id: true },
    });

    if (!demoTeacher) {
      return NextResponse.json({ success: true, message: "لا توجد بيانات معلم تجريبي" });
    }

    const teacherId = demoTeacher.id;
    const demoStudents = await prisma.user.findMany({
      where: { isDemo: true, role: "student" },
      select: { id: true },
    });
    const studentIds = demoStudents.map((s) => s.id);

    const demoCourses = await prisma.course.findMany({
      where: { teacherId },
      select: { id: true },
    });
    const courseIds = demoCourses.map((c) => c.id);

    const result = await prisma.$transaction(async (tx) => {
      const pt = await tx.parentToken.deleteMany({ where: { studentId: { in: studentIds } } });
      const pve = await tx.parentVerificationEvent.deleteMany({ where: { studentId: { in: studentIds } } });
      const sub = await tx.homeworkSubmission.deleteMany({ where: { studentId: { in: studentIds } } });
      const hw = await tx.homework.deleteMany({ where: { teacherId } });
      const qr = await tx.quizResult.deleteMany({ where: { studentId: { in: studentIds } } });
      const ac = await tx.accessCode.deleteMany({ where: { courseId: { in: courseIds } } });
      const fp = await tx.folderPurchase.deleteMany({ where: { studentId: { in: studentIds } } });
      const vp = await tx.videoPurchase.deleteMany({ where: { studentId: { in: studentIds } } });
      const ts = await tx.teacherSubscription.deleteMany({ where: { teacherId } });
      const c = await tx.course.deleteMany({ where: { teacherId } });
      const tp = await tx.teacherProfile.deleteMany({ where: { teacherId } });
      const u = await tx.user.deleteMany({ where: { isDemo: true } });

      return {
        parentTokens: pt.count,
        parentEvents: pve.count,
        submissions: sub.count,
        homeworks: hw.count,
        quizResults: qr.count,
        accessCodes: ac.count,
        folderPurchases: fp.count,
        videoPurchases: vp.count,
        teacherSubs: ts.count,
        courses: c.count,
        profiles: tp.count,
        users: u.count,
      };
    });

    resetDemoTeacherIdCache();

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error("Demo teardown error:", error);
    return NextResponse.json({ error: "فشل حذف بيانات المعلم التجريبي" }, { status: 500 });
  }
}
