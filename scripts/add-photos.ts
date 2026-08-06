import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const photoMap: Record<string, string> = {
  "فيزياء": "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?q=80&w=800&auto=format&fit=crop",
  "لغة عربية": "https://images.unsplash.com/photo-1583339174092-2b22ec6a2a0a?q=80&w=800&auto=format&fit=crop",
  "رياضيات": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop",
  "كيمياء": "https://images.unsplash.com/photo-1603126852883-cbdfa2e70c1a?q=80&w=800&auto=format&fit=crop",
  "لغة إنجليزية": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=800&auto=format&fit=crop",
  "أحياء": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=800&auto=format&fit=crop",
  "تاريخ": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop",
  "فلسفة": "https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=80&w=800&auto=format&fit=crop",
  "لغة فرنسية": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800&auto=format&fit=crop",
};

async function main() {
  console.log("Updating courses with photos...");
  const courses = await prisma.course.findMany();
  
  let updated = 0;
  for (const course of courses) {
    if (photoMap[course.subject]) {
      await prisma.course.update({
        where: { id: course.id },
        data: { thumbnailUrl: photoMap[course.subject] }
      });
      updated++;
    }
  }
  
  console.log(`Successfully added high-quality photos to ${updated} courses!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
