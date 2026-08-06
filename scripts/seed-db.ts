import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");
  const defaultPassword = await bcrypt.hash("123456", 10);

  let teacher = await prisma.user.findUnique({ where: { email: "mohamed@teacher.com" } });
  if (!teacher) {
    teacher = await prisma.user.create({
      data: {
        name: "أستاذ محمد",
        email: "mohamed@teacher.com",
        phone: "01012345678",
        password: defaultPassword,
        role: "teacher",
        isActive: true,
      }
    });
    console.log("Teacher created.");
  } else {
    console.log("Teacher already exists.");
  }

  const coursesData = [
    { title: "الفيزياء الشاملة - الصف الثالث الثانوي", subject: "فيزياء", educationalStage: "secondary_3", description: "شرح كامل وشامل لمنهج الفيزياء مدعم بالتجارب العملية وأسئلة النظام الجديد." },
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

  let courseCount = 0;
  for (const c of coursesData) {
    const exists = await prisma.course.findFirst({ where: { title: c.title } });
    if (!exists) {
      await prisma.course.create({
        data: {
          ...c,
          teacherId: teacher.id,
          isPaid: false,
          maxWatchCount: 5,
        }
      });
      courseCount++;
    }
  }
  console.log(`Created ${courseCount} courses.`);

  const studentNames = ["أحمد محمود", "سارة حسن", "يوسف أحمد", "مريم مصطفى", "علي حسين", "فاطمة إبراهيم", "عمر خالد", "نور طارق", "كريم سامي", "شهد عادل"];
  let studentCount = 0;
  for (let i = 0; i < 10; i++) {
    const email = `student${i + 1}@example.com`;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      await prisma.user.create({
        data: {
          name: studentNames[i],
          email: email,
          phone: `0111000000${i}`,
          password: defaultPassword,
          role: "student",
          educationalStage: "secondary_3",
          isActive: true,
          points: Math.floor(Math.random() * 500) + 100,
        }
      });
      studentCount++;
    }
  }
  console.log(`Created ${studentCount} students.`);
  console.log("Seeding complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
