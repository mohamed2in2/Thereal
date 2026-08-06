import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { EDUCATIONAL_STAGES } from "../src/types";

const PLAN_TYPES = [
  { 
    title: "خطة التأسيس الشاملة", 
    monthIndex: 1, 
    price: 50, 
    durationDays: 30, 
    description: "خطة مخصصة لتأسيس الطالب وتجهيزه للمنهج الأساسي." 
  },
  { 
    title: "خطة المنهج الأساسي (الشهر الأول)", 
    monthIndex: 2, 
    price: 100, 
    durationDays: 30, 
    description: "المنهج الأساسي للشهر الأول، يشمل جميع الدروس والواجبات." 
  },
  { 
    title: "خطة المراجعة النهائية", 
    monthIndex: 8, 
    price: 150, 
    durationDays: 45, 
    description: "مراجعة شاملة لجميع أجزاء المنهج والتدريب على الامتحانات." 
  },
];

async function main() {
  console.log("Seeding plans...");
  
  for (const stage of EDUCATIONAL_STAGES) {
    for (const planType of PLAN_TYPES) {
      const existing = await prisma.plan.findFirst({
        where: {
          educationalStage: stage.value,
          monthIndex: planType.monthIndex,
        },
      });
      
      if (!existing) {
        await prisma.plan.create({
          data: {
            educationalStage: stage.value,
            monthIndex: planType.monthIndex,
            title: planType.title,
            description: planType.description,
            price: planType.price,
            durationDays: planType.durationDays,
            status: "draft", 
            chatEnabled: true,
            gradingAIEnabled: true,
          }
        });
        console.log(`Created plan: ${planType.title} for stage: ${stage.value}`);
      } else {
        console.log(`Plan already exists: ${planType.title} for stage: ${stage.value}`);
      }
    }
  }
  
  console.log("Plans seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
