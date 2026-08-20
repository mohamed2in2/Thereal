/**
 * BM25 over the curriculum chunks.
 *
 * This is the retrieval floor: it needs no API call, works offline and is
 * deterministic, so a student always gets curriculum grounding even when the
 * embedding provider is unavailable.
 */

import { tokenise } from "./arabicText";
import { CurriculumChunk } from "./types";

const K1 = 1.2;
const B = 0.75;

interface Posting {
  docIndex: number;
  frequency: number;
}

export class LexicalIndex {
  private postings = new Map<string, Posting[]>();
  private lengths: number[] = [];
  private averageLength = 0;
  private docs: CurriculumChunk[] = [];

  constructor(chunks: CurriculumChunk[]) {
    this.docs = chunks;
    chunks.forEach((chunk, docIndex) => {
      // Titles carry the vocabulary students actually search with, so they are
      // indexed alongside the body rather than being left out.
      const tokens = tokenise(
        [chunk.text, chunk.lesson_title, chunk.chapter_title, chunk.section_title]
          .filter(Boolean)
          .join(" ")
      );
      this.lengths[docIndex] = tokens.length;
      const counts = new Map<string, number>();
      for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
      for (const [token, frequency] of counts) {
        let list = this.postings.get(token);
        if (!list) {
          list = [];
          this.postings.set(token, list);
        }
        list.push({ docIndex, frequency });
      }
    });
    const total = this.lengths.reduce((sum, n) => sum + n, 0);
    this.averageLength = chunks.length ? total / chunks.length : 0;
  }

  /** Ranked doc indices with BM25 scores, best first. */
  public search(question: string, limit: number): Array<{ docIndex: number; score: number }> {
    const queryTokens = tokenise(question);
    if (!queryTokens.length || !this.docs.length) return [];

    const scores = new Map<number, number>();
    const docCount = this.docs.length;

    for (const token of queryTokens) {
      const list = this.postings.get(token);
      if (!list) continue;
      const idf = Math.log(1 + (docCount - list.length + 0.5) / (list.length + 0.5));
      for (const { docIndex, frequency } of list) {
        const length = this.lengths[docIndex] || 0;
        const denominator =
          frequency + K1 * (1 - B + (B * length) / (this.averageLength || 1));
        const contribution = idf * ((frequency * (K1 + 1)) / (denominator || 1));
        scores.set(docIndex, (scores.get(docIndex) || 0) + contribution);
      }
    }

    return [...scores.entries()]
      .map(([docIndex, score]) => ({ docIndex, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
