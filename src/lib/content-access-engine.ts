import {
  ContentProgressStatus,
  ContentType,
  Prisma,
} from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export { ContentProgressStatus, ContentType };

export type ContentLocator = {
  type: ContentType;
  sourceId: string;
  title?: string;
};

export type RequiredContentItem = {
  id: string;
  title: string;
  type: ContentType;
};

export type ContentAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: "PREREQUISITE_LOCKED";
      requiredItem: RequiredContentItem;
    };

export type GraphContentItem = RequiredContentItem;

export type GraphPrerequisite = {
  targetContentId: string;
  prerequisiteContentId: string;
  requiredStatus?: ContentProgressStatus;
  minScore?: number | null;
};

export type GraphStudentProgress = {
  contentId: string;
  status: ContentProgressStatus;
  score?: number | null;
};

const STATUS_RANK: Record<ContentProgressStatus, number> = {
  LOCKED: 0,
  UNLOCKED: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
};

function compatibleContentTypes(type: ContentType): ContentType[] {
  if (type === ContentType.VIDEO || type === ContentType.SOLUTION_VIDEO) {
    return [type, type === ContentType.VIDEO ? ContentType.SOLUTION_VIDEO : ContentType.VIDEO];
  }
  if (type === ContentType.QUIZ) {
    return [ContentType.QUIZ, ContentType.EXAM];
  }
  if (type === ContentType.HOMEWORK) {
    return [ContentType.HOMEWORK, ContentType.EXAM];
  }
  if (type === ContentType.EXAM) {
    return [ContentType.EXAM, ContentType.QUIZ, ContentType.HOMEWORK];
  }
  return [type];
}

function satisfiesRule(
  progress: GraphStudentProgress | undefined,
  edge: GraphPrerequisite
): boolean {
  if (!progress) return false;

  const requiredStatus = edge.requiredStatus ?? ContentProgressStatus.COMPLETED;
  if (STATUS_RANK[progress.status] < STATUS_RANK[requiredStatus]) return false;

  return edge.minScore == null ||
    (typeof progress.score === "number" && progress.score >= edge.minScore);
}

/**
 * Pure graph evaluator used by both the database-backed engine and invariant
 * tests. Every incoming edge is authoritative; cycles fail closed.
 */
export function evaluateContentAccess(input: {
  targetContentId: string;
  items: readonly GraphContentItem[];
  prerequisites: readonly GraphPrerequisite[];
  progress: readonly GraphStudentProgress[];
}): ContentAccessDecision {
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const progressByContentId = new Map(
    input.progress.map((entry) => [entry.contentId, entry])
  );
  const edgesByTarget = new Map<string, GraphPrerequisite[]>();

  for (const edge of input.prerequisites) {
    const edges = edgesByTarget.get(edge.targetContentId) ?? [];
    edges.push(edge);
    edgesByTarget.set(edge.targetContentId, edges);
  }

  const visiting = new Set<string>();
  const resolved = new Set<string>();

  const blocked = (contentId: string): ContentAccessDecision => {
    const item = itemById.get(contentId) ?? itemById.get(input.targetContentId);
    if (!item) {
      throw new Error(`Content graph references missing item: ${contentId}`);
    }
    return { allowed: false, code: "PREREQUISITE_LOCKED", requiredItem: item };
  };

  const walk = (targetId: string): ContentAccessDecision => {
    if (resolved.has(targetId)) return { allowed: true };
    if (visiting.has(targetId)) return blocked(targetId);

    visiting.add(targetId);
    for (const edge of edgesByTarget.get(targetId) ?? []) {
      const prerequisite = itemById.get(edge.prerequisiteContentId);
      if (!prerequisite) return blocked(targetId);

      if (!satisfiesRule(progressByContentId.get(prerequisite.id), edge)) {
        return blocked(prerequisite.id);
      }

      const indirectDecision = walk(prerequisite.id);
      if (!indirectDecision.allowed) return indirectDecision;
    }

    visiting.delete(targetId);
    resolved.add(targetId);
    return { allowed: true };
  };

  return walk(input.targetContentId);
}

type LoadedContentItem = {
  id: string;
  title: string;
  type: ContentType;
  sourceId: string;
};

async function loadDependencyGraph(target: LoadedContentItem) {
  const items = new Map<string, LoadedContentItem>([[target.id, target]]);
  const prerequisites: GraphPrerequisite[] = [];
  const expanded = new Set<string>();
  let frontier = [target.id];

  while (frontier.length > 0) {
    const targetIds = frontier.filter((id) => !expanded.has(id));
    if (targetIds.length === 0) break;
    targetIds.forEach((id) => expanded.add(id));

    const edges = await prisma.contentPrerequisite.findMany({
      where: { targetContentId: { in: targetIds } },
      select: {
        targetContentId: true,
        prerequisiteContentId: true,
        requiredStatus: true,
        minScore: true,
        prerequisiteContent: {
          select: { id: true, title: true, type: true, sourceId: true },
        },
      },
    });

    frontier = [];
    for (const edge of edges) {
      prerequisites.push({
        targetContentId: edge.targetContentId,
        prerequisiteContentId: edge.prerequisiteContentId,
        requiredStatus: edge.requiredStatus,
        minScore: edge.minScore,
      });
      items.set(edge.prerequisiteContent.id, edge.prerequisiteContent);
      if (!expanded.has(edge.prerequisiteContent.id)) {
        frontier.push(edge.prerequisiteContent.id);
      }
    }
  }

  return { items: [...items.values()], prerequisites };
}

async function loadProgressWithLegacyFallback(
  studentId: string,
  items: readonly LoadedContentItem[]
): Promise<GraphStudentProgress[]> {
  const genericProgress = await prisma.studentContentProgress.findMany({
    where: { studentId, contentId: { in: items.map((item) => item.id) } },
    select: { contentId: true, status: true, score: true },
  });
  const progressByContentId = new Map<string, GraphStudentProgress>(
    genericProgress.map((entry) => [entry.contentId, entry])
  );
  const unresolved = items.filter((item) => !progressByContentId.has(item.id));

  const videoItems = unresolved.filter(
    (item) => item.type === ContentType.VIDEO || item.type === ContentType.SOLUTION_VIDEO
  );
  const quizItems = unresolved.filter(
    (item) => item.type === ContentType.QUIZ || item.type === ContentType.EXAM
  );
  const homeworkItems = unresolved.filter(
    (item) => item.type === ContentType.HOMEWORK || item.type === ContentType.EXAM
  );

  const [videoProgress, quizResults, homeworkSubmissions] = await Promise.all([
    videoItems.length
      ? prisma.progress.findMany({
          where: { studentId, videoId: { in: videoItems.map((item) => item.sourceId) } },
          select: { videoId: true, watched: true },
        })
      : [],
    quizItems.length
      ? prisma.quizResult.findMany({
          where: { studentId, quizId: { in: quizItems.map((item) => item.sourceId) } },
          select: { quizId: true, score: true, totalQ: true },
        })
      : [],
    homeworkItems.length
      ? prisma.homeworkSubmission.findMany({
          where: { studentId, homeworkId: { in: homeworkItems.map((item) => item.sourceId) } },
          select: { homeworkId: true, score: true },
        })
      : [],
  ]);

  const videoBySource = new Map<string, { watched: boolean }>();
  for (const entry of videoProgress) videoBySource.set(entry.videoId, entry);

  const quizBySource = new Map<string, { score: number; totalQ: number }>();
  for (const entry of quizResults) quizBySource.set(entry.quizId, entry);

  const homeworkBySource = new Map<string, { score: number | null }>();
  for (const entry of homeworkSubmissions) {
    homeworkBySource.set(entry.homeworkId, entry);
  }

  for (const item of unresolved) {
    if (item.type === ContentType.VIDEO || item.type === ContentType.SOLUTION_VIDEO) {
      const legacy = videoBySource.get(item.sourceId);
      if (legacy?.watched) {
        progressByContentId.set(item.id, {
          contentId: item.id,
          status: ContentProgressStatus.COMPLETED,
        });
      }
      continue;
    }

    if (item.type === ContentType.QUIZ || item.type === ContentType.EXAM) {
      const legacyQuiz = quizBySource.get(item.sourceId);
      if (legacyQuiz && legacyQuiz.totalQ > 0) {
        progressByContentId.set(item.id, {
          contentId: item.id,
          status: ContentProgressStatus.COMPLETED,
          score: legacyQuiz.score,
        });
        continue;
      }
    }

    if (item.type === ContentType.HOMEWORK || item.type === ContentType.EXAM) {
      const legacyHomework = homeworkBySource.get(item.sourceId);
      if (legacyHomework) {
        progressByContentId.set(item.id, {
          contentId: item.id,
          status: ContentProgressStatus.COMPLETED,
          score: legacyHomework.score,
        });
      }
    }
  }

  return [...progressByContentId.values()];
}

/** Authoritative server-side prerequisite gate for every supported content type. */
export async function canAccessContent(
  studentId: string,
  locator: ContentLocator
): Promise<ContentAccessDecision> {
  const candidates = await prisma.contentItem.findMany({
    where: {
      sourceId: locator.sourceId,
      type: { in: compatibleContentTypes(locator.type) },
    },
    select: { id: true, title: true, type: true, sourceId: true },
  });
  const target = candidates.find((item) => item.type === locator.type) ?? candidates[0];

  // Content without graph metadata has no declared prerequisite and remains
  // accessible through its existing enrollment/ownership authorization checks.
  if (!target) return { allowed: true };

  const graph = await loadDependencyGraph(target);
  const progress = await loadProgressWithLegacyFallback(studentId, graph.items);
  return evaluateContentAccess({
    targetContentId: target.id,
    items: graph.items,
    prerequisites: graph.prerequisites,
    progress,
  });
}

type ContentProgressDb = Pick<
  Prisma.TransactionClient,
  "contentItem" | "studentContentProgress"
>;

/**
 * Synchronizes a canonical completion/result into the generic graph state.
 * Pass the caller's transaction client when the legacy mutation must be atomic.
 */
export async function recordContentProgress(
  studentId: string,
  locator: ContentLocator,
  progress: {
    status: ContentProgressStatus;
    score?: number | null;
    completedAt?: Date | null;
  },
  db: ContentProgressDb = prisma
): Promise<void> {
  let items = await db.contentItem.findMany({
    where: {
      sourceId: locator.sourceId,
      type: { in: compatibleContentTypes(locator.type) },
    },
    select: { id: true },
  });

  if (items.length === 0) {
    const item = await db.contentItem.create({
      data: {
        type: locator.type,
        sourceId: locator.sourceId,
        title: locator.title ?? locator.sourceId,
      },
      select: { id: true },
    });
    items = [item];
  } else if (locator.title) {
    await db.contentItem.updateMany({
      where: { id: { in: items.map((item) => item.id) } },
      data: { title: locator.title },
    });
  }

  for (const item of items) {
    await db.studentContentProgress.upsert({
      where: { studentId_contentId: { studentId, contentId: item.id } },
      create: {
        studentId,
        contentId: item.id,
        status: progress.status,
        score: progress.score ?? null,
        completedAt: progress.completedAt ?? null,
      },
      update: {
        status: progress.status,
        score: progress.score ?? null,
        completedAt: progress.completedAt ?? null,
      },
    });
  }
}

export async function recordContentCompleted(
  studentId: string,
  locator: ContentLocator,
  options: { score?: number | null; completedAt?: Date } = {},
  db: ContentProgressDb = prisma
): Promise<void> {
  await recordContentProgress(
    studentId,
    locator,
    {
      status: ContentProgressStatus.COMPLETED,
      score: options.score,
      completedAt: options.completedAt ?? new Date(),
    },
    db
  );
}
