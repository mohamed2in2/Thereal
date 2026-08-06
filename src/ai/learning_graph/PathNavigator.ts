import { CurriculumNode, LearningGraph } from "./LearningGraph";

export class PathNavigator {
  private graph: LearningGraph;

  constructor(graph?: LearningGraph) {
    this.graph = graph || new LearningGraph();
  }

  public getNextOptimalLesson(
    currentLessonId: string,
    completedLessons: string[],
    weakTopics: string[] = []
  ): CurriculumNode | undefined {
    const currentNode = this.graph.getNode(currentLessonId);

    // 1. Check if weak topic maps to a revision link
    if (weakTopics.length > 0 && currentNode?.revisionLinks.length) {
      const revId = currentNode.revisionLinks[0];
      const revNode = this.graph.getNode(revId);
      if (revNode) return revNode;
    }

    // 2. Check recommended next lessons whose prerequisites are satisfied
    if (currentNode) {
      for (const nextId of currentNode.recommendedNextLessons) {
        const { satisfied } = this.graph.checkPrerequisites(nextId, completedLessons);
        if (satisfied) {
          return this.graph.getNode(nextId);
        }
      }
    }

    // 3. Fallback to any uncompleted node with satisfied prerequisites
    for (const node of this.graph.getAllNodes()) {
      if (!completedLessons.includes(node.id)) {
        const { satisfied } = this.graph.checkPrerequisites(node.id, completedLessons);
        if (satisfied) return node;
      }
    }

    return undefined;
  }
}
