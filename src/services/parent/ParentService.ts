export type ParentRelationship = "Father" | "Mother" | "Guardian";
export type NotificationChannel = "whatsapp" | "sms" | "email";

export interface ParentProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  whatsApp?: string;
  relationship: ParentRelationship;
  notificationPreferences: NotificationChannel[];
  linkedStudentIds: string[];
  createdAt: string;
}

export class ParentService {
  private static instance: ParentService;
  private parents: Map<string, ParentProfile> = new Map();
  private studentToParents: Map<string, string[]> = new Map();

  public static getInstance(): ParentService {
    if (!ParentService.instance) {
      ParentService.instance = new ParentService();
    }
    return ParentService.instance;
  }

  public createParent(data: {
    name: string;
    phone: string;
    email?: string;
    whatsApp?: string;
    relationship: ParentRelationship;
    notificationPreferences?: NotificationChannel[];
  }): ParentProfile {
    const parentId = `prt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const profile: ParentProfile = {
      id: parentId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsApp: data.whatsApp || data.phone,
      relationship: data.relationship,
      notificationPreferences: data.notificationPreferences || ["whatsapp", "sms"],
      linkedStudentIds: [],
      createdAt: new Date().toISOString(),
    };

    this.parents.set(parentId, profile);
    return profile;
  }

  public linkStudentToParent(parentId: string, studentId: string): boolean {
    const parent = this.parents.get(parentId);
    if (!parent) return false;

    if (!parent.linkedStudentIds.includes(studentId)) {
      parent.linkedStudentIds.push(studentId);
    }

    const linked = this.studentToParents.get(studentId) || [];
    if (!linked.includes(parentId)) {
      linked.push(parentId);
      this.studentToParents.set(studentId, linked);
    }

    return true;
  }

  public getParentsByStudentId(studentId: string): ParentProfile[] {
    const parentIds = this.studentToParents.get(studentId) || [];
    return parentIds.map(id => this.parents.get(id)).filter((p): p is ParentProfile => p !== undefined);
  }

  public getParentById(parentId: string): ParentProfile | undefined {
    return this.parents.get(parentId);
  }
}
