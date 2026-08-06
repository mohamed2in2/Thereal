export type KnowledgeApprovalStatus = "Draft" | "Review" | "Approved" | "Published" | "Archived";

export interface VersionedKnowledgeDoc {
  docId: string;
  version: number;
  title: string;
  content: string;
  status: KnowledgeApprovalStatus;
  author: string;
  approvedBy?: string;
  createdAt: Date;
}

export class KnowledgeVersionControl {
  private static instance: KnowledgeVersionControl;
  private versions: Map<string, VersionedKnowledgeDoc[]> = new Map();

  public static getInstance(): KnowledgeVersionControl {
    if (!KnowledgeVersionControl.instance) {
      KnowledgeVersionControl.instance = new KnowledgeVersionControl();
    }
    return KnowledgeVersionControl.instance;
  }

  public createNewVersion(
    docId: string,
    title: string,
    content: string,
    author: string
  ): VersionedKnowledgeDoc {
    const history = this.versions.get(docId) || [];
    const newVersionNum = history.length + 1;

    const doc: VersionedKnowledgeDoc = {
      docId,
      version: newVersionNum,
      title,
      content,
      status: "Draft",
      author,
      createdAt: new Date(),
    };

    history.push(doc);
    this.versions.set(docId, history);
    return doc;
  }

  public updateStatus(
    docId: string,
    version: number,
    status: KnowledgeApprovalStatus,
    approvedBy?: string
  ): boolean {
    const history = this.versions.get(docId);
    if (!history) return false;

    const target = history.find((v) => v.version === version);
    if (target) {
      target.status = status;
      if (approvedBy) target.approvedBy = approvedBy;
      return true;
    }

    return false;
  }

  public getPublishedVersion(docId: string): VersionedKnowledgeDoc | undefined {
    const history = this.versions.get(docId);
    if (!history) return undefined;
    return history.slice().reverse().find((v) => v.status === "Published");
  }
}
