import { DocumentChunk } from "./TextChunker";
import { RAGDocument } from "./DocumentLoader";

export interface SearchHit {
  chunk: DocumentChunk;
  document: RAGDocument;
  relevanceScore: number;
}

export class RetrievalIndex {
  private static instance: RetrievalIndex;
  private documents: Map<string, RAGDocument> = new Map();
  private chunks: DocumentChunk[] = [];

  public static getInstance(): RetrievalIndex {
    if (!RetrievalIndex.instance) {
      RetrievalIndex.instance = new RetrievalIndex();
    }
    return RetrievalIndex.instance;
  }

  public indexDocument(doc: RAGDocument, docChunks: DocumentChunk[]): void {
    this.documents.set(doc.id, doc);
    this.chunks.push(...docChunks);
  }

  public search(query: string, topK = 3): SearchHit[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits: SearchHit[] = [];

    for (const chunk of this.chunks) {
      const chunkText = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const term of queryTerms) {
        if (chunkText.includes(term)) matchCount++;
      }

      if (matchCount > 0) {
        const doc = this.documents.get(chunk.documentId);
        if (doc) {
          hits.push({
            chunk,
            document: doc,
            relevanceScore: matchCount / queryTerms.length,
          });
        }
      }
    }

    // Rank hits by relevance score descending
    return hits
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  }
}
