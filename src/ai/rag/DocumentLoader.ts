export type RAGSourceType =
  | "lesson_content"
  | "teacher_notes"
  | "pdf"
  | "textbook_extract"
  | "quiz"
  | "homework"
  | "flashcard"
  | "transcript"
  | "ministry_doc";

export interface RAGDocument {
  id: string;
  sourceType: RAGSourceType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export class DocumentLoader {
  public static createDocument(
    sourceType: RAGSourceType,
    title: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): RAGDocument {
    return {
      id: `doc_${sourceType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceType,
      title,
      content,
      metadata,
      createdAt: new Date(),
    };
  }
}
