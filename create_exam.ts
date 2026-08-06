import { prisma } from "./src/lib/prisma";

async function main() {
  const exam = await prisma.dailyExam.create({
    data: {
      title: 'التحدي اليومي الأول - تجريبي',
      educationalStage: 'secondary_3',
      date: new Date(),
      timeLimitMinutes: 20,
      isActive: true,
      questions: {
        create: [
          {
            question: 'ما هي عاصمة جمهورية مصر العربية؟',
            optionA: 'القاهرة',
            optionB: 'الإسكندرية',
            optionC: 'الأقصر',
            optionD: 'أسوان',
            correctAnswer: 'A',
            order: 1
          },
          {
            question: 'كم عدد محافظات مصر؟',
            optionA: '25',
            optionB: '27',
            optionC: '29',
            optionD: '30',
            correctAnswer: 'B',
            order: 2
          }
        ]
      }
    }
  });
  console.log('Successfully created exam with ID:', exam.id);
}

main().finally(() => prisma.$disconnect());
