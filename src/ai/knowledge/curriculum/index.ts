export * from "./types";
export * from "./arabicText";
export { LexicalIndex } from "./LexicalIndex";
export { FileCurriculumStore } from "./FileCurriculumStore";
export { CurriculumRetriever } from "./CurriculumRetriever";
export { buildGrounding, citationFor } from "./CurriculumGrounding";
export type { GroundingResult } from "./CurriculumGrounding";
export {
  embedText,
  embeddingsAvailable,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "./EmbeddingClient";
