/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateStudyPlan, validateStudyPlan } from "@/lib/ai-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only students can access their own study plans
    if (session.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get date parameter (defaults to today)
    const dateParam = req.nextUrl.searchParams.get("date");
    const planDate = dateParam ? new Date(dateParam) : new Date();
    planDate.setHours(0, 0, 0, 0);

    // Check if plan exists for this date
    const studyPlan = await (prisma as any).dailyStudyPlan.findUnique({
      where: {
        studentId_planDate: {
          studentId: session.id,
          planDate,
        },
      },
    });

    if (studyPlan) {
      return NextResponse.json({
        success: true,
        plan: {
          id: studyPlan.id,
          date: studyPlan.planDate,
          content: JSON.parse(studyPlan.content),
          status: studyPlan.status,
        },
      });
    }

    // Plan doesn't exist, return a message
    return NextResponse.json({
      success: true,
      plan: null,
      message: "لا توجد خطة تدريبية لهذا اليوم. يمكنك إنشاء واحدة جديدة.",
    });
  } catch (error) {
    console.error("Error fetching study plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch study plan" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get student data for AI generation
    const student = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        courses: { include: { teacher: true } },
        quizResults: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Get enrolled courses
    const enrolledCourses = await prisma.course.findMany({
      where: {
        accessCodes: {
          some: {
            student: { id: session.id },
            isActive: true,
          },
        },
      },
      select: { id: true, title: true },
    });

    // Calculate average quiz score
    const quizResults = await prisma.quizResult.findMany({
      where: { studentId: session.id },
    });

    const averageScore = quizResults.length > 0 
      ? quizResults.reduce((sum, r) => sum + r.score, 0) / quizResults.length
      : 0;

    // Count watched videos
    const watchedVideos = await prisma.progress.count({
      where: {
        studentId: session.id,
        watched: true,
      },
    });

    // Generate study plan via AI
    const aiResponse = await generateStudyPlan(
      {
        coursesEnrolled: enrolledCourses.map(c => c.id),
        videosWatched: watchedVideos,
        averageQuizScore: averageScore,
        educationalStage: student.educationalStage || "prep_1",
      },
      enrolledCourses.map(c => c.title)
    );

    if (!aiResponse.success || !aiResponse.plan) {
      return NextResponse.json(
        { error: "Failed to generate study plan" },
        { status: 500 }
      );
    }

    // Validate and save plan
    const validatedPlan = validateStudyPlan(aiResponse.plan);
    const planDate = new Date();
    planDate.setHours(0, 0, 0, 0);

    const savedPlan = await (prisma as any).dailyStudyPlan.upsert({
      where: {
        studentId_planDate: {
          studentId: session.id,
          planDate,
        },
      },
      update: {
        content: JSON.stringify(validatedPlan),
        status: "pending",
      },
      create: {
        studentId: session.id,
        planDate,
        content: JSON.stringify(validatedPlan),
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: savedPlan.id,
        date: savedPlan.planDate,
        content: validatedPlan,
        status: savedPlan.status,
      },
    });
  } catch (error) {
    console.error("Error creating study plan:", error);
    return NextResponse.json(
      { error: "Failed to create study plan" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json() as { id: string; status: string };
    const { id, status } = body;

    const ALLOWED_STATUSES = ["pending", "completed", "skipped"];
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    // Verify ownership
    const plan = await (prisma as any).dailyStudyPlan.findUnique({
      where: { id },
    });

    if (!plan || plan.studentId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update status
    const updatedPlan = await (prisma as any).dailyStudyPlan.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: updatedPlan.id,
        date: updatedPlan.planDate,
        content: JSON.parse(updatedPlan.content),
        status: updatedPlan.status,
      },
    });
  } catch (error) {
    console.error("Error updating study plan:", error);
    return NextResponse.json(
      { error: "Failed to update study plan" },
      { status: 500 }
    );
  }
}
