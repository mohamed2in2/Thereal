/**
 * Types for the official curriculum knowledge base.
 *
 * A "chunk" is one retrieval unit produced by scripts/curriculum/ingest.py from
 * the official Ministry PDFs. Chunks are never rewritten at runtime: what the
 * student sees quoted is what the textbook says.
 */

export type CurriculumContentType =
  | "learning_objectives"
  | "lesson_map"
  | "main_idea"
  | "key_concepts"
  | "learning_path"
  | "terminology"
  | "explanation"
  | "important_note"
  | "solved_example"
  | "solution"
  | "activity"
  | "practice"
  | "exercises"
  | "application"
  | "exam_style_question"
  | "key_question"
  | "key_question_answer"
  | "reflection"
  | "challenge"
  | "engineering_task"
  | "review"
  | "summary";

/** Content the student should be guided through rather than simply given. */
export const QUESTION_CONTENT_TYPES: ReadonlySet<string> = new Set<string>([
  "exercises",
  "practice",
  "exam_style_question",
  "activity",
  "application",
  "challenge",
  "engineering_task",
  "key_question",
  "reflection",
]);

export interface CurriculumChunk {
  id: string;
  subject: string;
  subject_ar: string;
  grade: string;
  grade_ar: string;
  curriculum: string;
  curriculum_ar: string;
  language: string;
  term: number;
  chapter_number: number;
  chapter_title: string | null;
  lesson_number: string;
  lesson_title: string | null;
  section_title: string | null;
  content_type: CurriculumContentType | string;
  page_start: number;
  page_end: number;
  /** Page number as printed in the textbook (what a student sees). */
  book_page_start: number;
  book_page_end: number;
  source: string;
  source_file: string;
  is_official_curriculum: true;
  text: string;
  char_count: number;
}

/** Where the student currently is, used to bias retrieval. */
export interface CurriculumScope {
  subject?: string;
  grade?: string;
  term?: number;
  chapterNumber?: number;
  lessonNumber?: string;
  contentTypes?: string[];
}

export interface RetrievalQuery {
  question: string;
  scope?: CurriculumScope;
  limit?: number;
}

export interface RetrievedChunk {
  chunk: CurriculumChunk;
  score: number;
  lexicalRank: number | null;
  semanticRank: number | null;
  /** True when the chunk matched the student's current lesson/chapter. */
  scopeMatched: boolean;
}

export interface CurriculumStore {
  ready(): Promise<void>;
  all(): CurriculumChunk[];
  size(): number;
  vectorFor(chunkId: string): Float32Array | null;
  hasVectors(): boolean;
}
