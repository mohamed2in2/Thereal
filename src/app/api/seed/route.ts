import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const defaultPassword = await bcrypt.hash("123456", 10);

    // 1. Create Teacher
    const teacher = await prisma.user.create({
      data: {
        name: "أستاذ محمد",
        email: "mohamed@teacher.com",
        phone: "01012345678",
        password: defaultPassword,
        role: "teacher",
        isActive: true,
      }
    });

    // 2. Create 10 Courses
    const coursesData = [
      { title: "الفيزياء الشاملة - المستوى المتقدم", subject: "فيزياء", educationalStage: "secondary_3", description: "شرح كامل وشامل لمنهج الفيزياء مدعم بالتجارب العملية وأسئلة النظام الجديد." },
      { title: "اللغة العربية - النحو والبلاغة", subject: "لغة عربية", educationalStage: "secondary_3", description: "تأسيس متكامل في النحو والبلاغة لضمان الدرجة النهائية." },
      { title: "الرياضيات التطبيقية - الميكانيكا", subject: "رياضيات", educationalStage: "secondary_2", description: "كورس مخصص لفهم الديناميكا والاستاتيكا بأسلوب مبسط." },
      { title: "الكيمياء العضوية", subject: "كيمياء", educationalStage: "secondary_3", description: "رحلة ممتعة في الكيمياء العضوية مع حل آلاف الأسئلة." },
      { title: "اللغة الإنجليزية - تأسيس شامل", subject: "لغة إنجليزية", educationalStage: "secondary_1", description: "شرح شامل للقواعد وحفظ الكلمات بطرق حديثة." },
      { title: "الأحياء - النظام الحديث", subject: "أحياء", educationalStage: "secondary_3", description: "فهم عميق لكل تفاصيل المنهج بعيداً عن الحفظ التلقيني." },
      { title: "التاريخ والجغرافيا للثانوية", subject: "تاريخ", educationalStage: "secondary_3", description: "ربط الأحداث التاريخية بأسلوب قصصي يسهل استيعابه." },
      { title: "الفلسفة والمنطق", subject: "فلسفة", educationalStage: "secondary_2", description: "مفاتيح الفهم السريع للفلسفة الحديثة." },
      { title: "الرياضيات البحتة - التفاضل والتكامل", subject: "رياضيات", educationalStage: "secondary_3", description: "التدريب على أصعب المسائل للوصول لمستوى التفوق." },
      { title: "اللغة الفرنسية", subject: "لغة فرنسية", educationalStage: "secondary_1", description: "الخطوة الأولى نحو إتقان اللغة الفرنسية بطريقة تفاعلية." },
    ];

    for (const c of coursesData) {
      await prisma.course.create({
        data: {
          ...c,
          teacherId: teacher.id,
          isPaid: false,
          maxWatchCount: 5,
        }
      });
    }

    // 3. Create 10 Students
    const studentNames = ["أحمد محمود", "سارة حسن", "يوسف أحمد", "مريم مصطفى", "علي حسين", "فاطمة إبراهيم", "عمر خالد", "نور طارق", "كريم سامي", "شهد عادل"];
    for (let i = 0; i < 10; i++) {
      await prisma.user.create({
        data: {
          name: studentNames[i],
          email: `student${i + 1}@example.com`,
          phone: `0111000000${i}`,
          password: defaultPassword,
          role: "student",
          educationalStage: "secondary_3",
          isActive: true,
          points: Math.floor(Math.random() * 500) + 100, // Random leaderboard points
        }
      });
    }

    return NextResponse.json({ success: true, message: "Database seeded successfully!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
