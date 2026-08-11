import { prisma } from "@/lib/prisma";
import { resolvePlanProviders, type ResolvedProvider } from "@/lib/ai-provider";
import { notifyProjectGraded } from "@/lib/notifications";
import { getConfigNumberClamped } from "@/lib/config";

interface GradingResult {
  passed: boolean;
  grade: number;
  feedback: string;
}

const SYSTEM_PROMPT = `You are a strict programming tutor. Evaluate the student's project submission based on the lesson title.
Provide a grade from 0 to 100, passed (true if grade >= 50, false otherwise), and constructive feedback in Arabic.
You must return only a valid JSON object matching this structure:
{
  "passed": true,
  "grade": 85,
  "feedback": "ملاحظاتك هنا باللغة العربية"
}`;

async function callGradingProvider(
  provider: ResolvedProvider,
  lessonTitle: string,
  submissionContent: string,
  maxTokens: number
): Promise<GradingResult> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const prompt = `Lesson Title: ${lessonTitle}\nStudent Submission:\n${submissionContent}\n\nEvaluate the submission and return the JSON.`;
  let responseText = "";

  if (provider.kind === "anthropic") {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    responseText = data.content?.[0]?.text || "";
  } else if (provider.kind === "gemini") {
    const res = await fetch(`${base}/${provider.model}:generateContent?key=${provider.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else {
    // OpenAI-compatible
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    responseText = data.choices?.[0]?.message?.content || "";
  }

  // Parse JSON output
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : responseText).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  const parsed = JSON.parse(candidate.slice(start, end + 1)) as GradingResult;

  if (typeof parsed.passed !== "boolean" || typeof parsed.grade !== "number" || typeof parsed.feedback !== "string") {
    throw new Error("Invalid grading schema from LLM");
  }

  return parsed;
}

export async function evaluateProjectWithAI(submissionId: string): Promise<void> {
  // 1. Atomic status transition: pending -> processing
  const now = new Date();
  const affected = await prisma.planProjectSubmission.updateMany({
    where: { id: submissionId, status: "pending" },
    data: { status: "processing" },
  });

  if (affected.count === 0) {
    // Already claimed or graded
    return;
  }

  const submission = await prisma.planProjectSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) return;

  // Retrieve lesson title
  const lesson = await prisma.planLesson.findUnique({
    where: { id: submission.planLessonId },
    select: { title: true },
  });
  const lessonTitle = lesson?.title ?? "مشروع عملي";

  try {
    const { primary, backup } = await resolvePlanProviders();
    const maxTokens = await getConfigNumberClamped("ai_max_tokens", 512, 8192);

    let result: GradingResult | null = null;
    if (primary) {
      try {
        result = await callGradingProvider(primary, lessonTitle, submission.content, maxTokens);
      } catch (err) {
        console.error(`Primary AI grading failed:`, err);
      }
    }

    if (!result && backup) {
      try {
        result = await callGradingProvider(backup, lessonTitle, submission.content, maxTokens);
      } catch (err) {
        console.error(`Backup AI grading failed:`, err);
      }
    }

    if (!result) {
      throw new Error("All AI grading providers failed");
    }

    // Success: Transactional write to submission + progress + notification
    await prisma.$transaction(async (tx: any) => {
      await tx.planProjectSubmission.update({
        where: { id: submissionId },
        data: {
          status: "graded",
          grade: result!.grade,
          feedback: result!.feedback,
          gradedAt: now,
        },
      });

      await tx.planLessonProgress.upsert({
        where: {
          enrollmentId_planLessonId: {
            enrollmentId: submission.enrollmentId,
            planLessonId: submission.planLessonId,
          },
        },
        create: {
          enrollmentId: submission.enrollmentId,
          planLessonId: submission.planLessonId,
          projectPassed: result!.passed,
          projectGrade: result!.grade,
        },
        update: {
          projectPassed: result!.passed,
          projectGrade: result!.grade,
        },
      });
    });

    // Notify student
    await notifyProjectGraded(submission.studentId, lessonTitle, result.grade);
  } catch (error) {
    console.error(`Grading queue error for submission ${submissionId}:`, error);
    
    // Failure handling: increment retryCount and revert status to pending or set to failed
    const updatedSubmission = await prisma.planProjectSubmission.findUnique({
      where: { id: submissionId },
      select: { retryCount: true },
    });

    const currentRetry = (updatedSubmission?.retryCount ?? 0) + 1;
    const finalStatus = currentRetry >= 3 ? "failed" : "pending";

    await prisma.planProjectSubmission.update({
      where: { id: submissionId },
      data: {
        status: finalStatus,
        retryCount: currentRetry,
      },
    });
  }
}
