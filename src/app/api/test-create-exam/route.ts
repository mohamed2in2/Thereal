import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
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
    return NextResponse.json({ success: true, exam });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
