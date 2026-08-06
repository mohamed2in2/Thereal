export type KnowledgeStatus = "Draft" | "Published" | "Archived";

export interface ManagedKnowledgeItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  content: string;
  status: KnowledgeStatus;
  author: string;
  updatedAt: Date;
}

export class KnowledgeManager {
  private static instance: KnowledgeManager;
  private items: Map<string, ManagedKnowledgeItem> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): KnowledgeManager {
    if (!KnowledgeManager.instance) {
      KnowledgeManager.instance = new KnowledgeManager();
    }
    return KnowledgeManager.instance;
  }

  private seedDefaults(): void {
    this.addKnowledge({
      id: "kn_math_01",
      title: "قواعد الجبر والمعادلات - الصف الأول الثانوي",
      subject: "رياضيات",
      grade: "sec_1",
      content: "قواعد التعويض والتحليل إلى العوامل في الرياضيات.",
      status: "Published",
      author: "Superadmin",
      updatedAt: new Date(),
    });

    this.addKnowledge({
      id: "kn_chem_draft",
      title: "مسودة التفاعلات الكيميائية",
      subject: "كيمياء",
      grade: "sec_2",
      content: "مستند قيد المراجعة حول تفاعلات الأكسدة والاختزال.",
      status: "Draft",
      author: "Teacher Ahmed",
      updatedAt: new Date(),
    });
  }

  public addKnowledge(item: ManagedKnowledgeItem): void {
    this.items.set(item.id, item);
  }

  public setStatus(id: string, status: KnowledgeStatus): void {
    const item = this.items.get(id);
    if (item) {
      item.status = status;
      item.updatedAt = new Date();
    }
  }

  public getPublishedKnowledge(subject: string, grade?: string): ManagedKnowledgeItem[] {
    return Array.from(this.items.values()).filter(
      (item) =>
        item.status === "Published" &&
        item.subject.toLowerCase() === subject.toLowerCase() &&
        (!grade || item.grade === grade)
    );
  }
}
