/**
 * Hybrid retrieval over the official curriculum.
 *
 * Lexical (BM25) and semantic (embedding) rankings are fused with reciprocal
 * rank fusion, then nudged by where the student currently is: a question asked
 * while studying lesson 1-2 should surface lesson 1-2 before anything else.
 * Scope is a preference, not a filter — a student asking a question that lives
 * in a later lesson still gets the right answer.
 */

import { FileCurriculumStore } from "./FileCurriculumStore";
import { LexicalIndex } from "./LexicalIndex";
import { dot, embedText, embeddingsAvailable } from "./EmbeddingClient";
import {
  CurriculumChunk,
  CurriculumScope,
  CurriculumStore,
  RetrievalQuery,
  RetrievedChunk,
} from "./types";

/** Damping constant for reciprocal rank fusion. */
const RRF_K = 60;
const DEFAULT_LIMIT = 6;
const CANDIDATE_DEPTH = 40;

const SCOPE_BOOST = {
  lesson: 0.45,
  chapter: 0.2,
  term: 0.08,
};

export class CurriculumRetriever {
  private static instance: CurriculumRetriever | null = null;

  private store: CurriculumStore;
  private lexical: LexicalIndex | null = null;
  private preparing: Promise<void> | null = null;

  constructor(store?: CurriculumStore) {
    this.store = store || FileCurriculumStore.getInstance();
  }

  public static getInstance(): CurriculumRetriever {
    if (!CurriculumRetriever.instance) {
      CurriculumRetriever.instance = new CurriculumRetriever();
    }
    return CurriculumRetriever.instance;
  }

  private async prepare(): Promise<void> {
    if (this.lexical) return;
    if (!this.preparing) {
      this.preparing = (async () => {
        await this.store.ready();
        this.lexical = new LexicalIndex(this.store.all());
      })();
    }
    await this.preparing;
  }

  public async isAvailable(): Promise<boolean> {
    await this.prepare();
    return this.store.size() > 0;
  }

  public async retrieve(query: RetrievalQuery): Promise<RetrievedChunk[]> {
    await this.prepare();
    const chunks = this.store.all();
    if (!chunks.length || !query.question.trim()) return [];

    const limit = query.limit ?? DEFAULT_LIMIT;
    const scope = query.scope || {};
    const eligible = this.eligibleIndices(chunks, scope);
    if (!eligible.size) return [];

    const fused = new Map<number, { score: number; lexicalRank: number | null; semanticRank: number | null }>();

    const lexicalHits = this.lexical!.search(query.question, CANDIDATE_DEPTH * 2)
      .filter((hit) => eligible.has(hit.docIndex))
      .slice(0, CANDIDATE_DEPTH);
    lexicalHits.forEach((hit, rank) => {
      fused.set(hit.docIndex, {
        score: 1 / (RRF_K + rank + 1),
        lexicalRank: rank + 1,
        semanticRank: null,
      });
    });

    const semanticHits = await this.semanticSearch(query.question, chunks, eligible);
    semanticHits.forEach((docIndex, rank) => {
      const existing = fused.get(docIndex);
      const contribution = 1 / (RRF_K + rank + 1);
      if (existing) {
        existing.score += contribution;
        existing.semanticRank = rank + 1;
      } else {
        fused.set(docIndex, {
          score: contribution,
          lexicalRank: null,
          semanticRank: rank + 1,
        });
      }
    });

    const results: RetrievedChunk[] = [];
    for (const [docIndex, entry] of fused) {
      const chunk = chunks[docIndex];
      const boost = this.scopeBoost(chunk, scope);
      results.push({
        chunk,
        score: entry.score * (1 + boost),
        lexicalRank: entry.lexicalRank,
        semanticRank: entry.semanticRank,
        scopeMatched: boost > 0,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async semanticSearch(
    question: string,
    chunks: CurriculumChunk[],
    eligible: Set<number>
  ): Promise<number[]> {
    if (!this.store.hasVectors() || !embeddingsAvailable()) return [];
    const queryVector = await embedText(question, { taskType: "RETRIEVAL_QUERY" });
    if (!queryVector) return [];

    const scored: Array<{ docIndex: number; similarity: number }> = [];
    chunks.forEach((chunk, docIndex) => {
      if (!eligible.has(docIndex)) return;
      const vector = this.store.vectorFor(chunk.id);
      if (!vector) return;
      scored.push({ docIndex, similarity: dot(queryVector, vector) });
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, CANDIDATE_DEPTH)
      .map((entry) => entry.docIndex);
  }

  /**
   * Hard constraints only. Subject and grade genuinely exclude content; the
   * student's current lesson must not, or they could never ask ahead.
   */
  private eligibleIndices(chunks: CurriculumChunk[], scope: CurriculumScope): Set<number> {
    const eligible = new Set<number>();
    chunks.forEach((chunk, index) => {
      if (scope.grade && chunk.grade !== scope.grade) return;
      if (scope.contentTypes?.length && !scope.contentTypes.includes(chunk.content_type)) return;
      eligible.add(index);
    });
    return eligible;
  }

  private scopeBoost(chunk: CurriculumChunk, scope: CurriculumScope): number {
    let boost = 0;
    if (scope.lessonNumber && chunk.lesson_number === scope.lessonNumber) {
      boost += SCOPE_BOOST.lesson;
    }
    if (scope.chapterNumber && chunk.chapter_number === scope.chapterNumber) {
      boost += SCOPE_BOOST.chapter;
    }
    if (scope.term && chunk.term === scope.term) {
      boost += SCOPE_BOOST.term;
    }
    return boost;
  }
}
