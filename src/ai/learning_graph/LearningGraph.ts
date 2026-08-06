export interface CurriculumNode {
  id: string;
  title: string;
  subject: string;
  prerequisites: string[];       // Lesson IDs required before this lesson
  dependencies: string[];        // Lesson IDs unlocked by this lesson
  recommendedNextLessons: string[];
  relatedLessons: string[];
  revisionLinks: string[];
}

export class LearningGraph {
  private nodes: Map<string, CurriculumNode> = new Map();

  constructor() {
    this.seedDefaultGraph();
  }

  private seedDefaultGraph(): void {
    // Seed standard programming & science nodes
    this.addNode({
      id: "lsn_101",
      title: "المتغيرات وأنواع البيانات",
      subject: "برمجه عملي",
      prerequisites: [],
      dependencies: ["lsn_102", "lsn_103"],
      recommendedNextLessons: ["lsn_102"],
      relatedLessons: ["lsn_104"],
      revisionLinks: ["rev_vars_1"],
    });

    this.addNode({
      id: "lsn_102",
      title: "الجمل الشرطية (If Statements)",
      subject: "برمجه عملي",
      prerequisites: ["lsn_101"],
      dependencies: ["lsn_103"],
      recommendedNextLessons: ["lsn_103"],
      relatedLessons: ["lsn_101"],
      revisionLinks: ["rev_cond_1"],
    });

    this.addNode({
      id: "lsn_103",
      title: "الحلقات التكرارية (Loops)",
      subject: "برمجه عملي",
      prerequisites: ["lsn_101", "lsn_102"],
      dependencies: ["lsn_104"],
      recommendedNextLessons: ["lsn_104"],
      relatedLessons: ["lsn_102"],
      revisionLinks: ["rev_loops_1"],
    });

    this.addNode({
      id: "lsn_104",
      title: "الدوال والوحدات (Functions)",
      subject: "برمجه عملي",
      prerequisites: ["lsn_103"],
      dependencies: [],
      recommendedNextLessons: [],
      relatedLessons: ["lsn_103"],
      revisionLinks: ["rev_funcs_1"],
    });
  }

  public addNode(node: CurriculumNode): void {
    this.nodes.set(node.id, node);
  }

  public getNode(id: string): CurriculumNode | undefined {
    return this.nodes.get(id);
  }

  public checkPrerequisites(lessonId: string, completedLessons: string[]): {
    satisfied: boolean;
    missingPrerequisites: string[];
  } {
    const node = this.getNode(lessonId);
    if (!node) return { satisfied: true, missingPrerequisites: [] };

    const missing = node.prerequisites.filter((p) => !completedLessons.includes(p));
    return {
      satisfied: missing.length === 0,
      missingPrerequisites: missing,
    };
  }

  public getAllNodes(): CurriculumNode[] {
    return Array.from(this.nodes.values());
  }
}
