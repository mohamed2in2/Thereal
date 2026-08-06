export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  wordCount: number;
}

export class TextChunker {
  public static chunkDocument(
    documentId: string,
    text: string,
    chunkSizeWords = 150,
    overlapWords = 30
  ): DocumentChunk[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: DocumentChunk[] = [];
    let idx = 0;
    let chunkCount = 0;

    while (idx < words.length) {
      const chunkWords = words.slice(idx, idx + chunkSizeWords);
      const chunkContent = chunkWords.join(" ");

      chunks.push({
        chunkId: `${documentId}_chk_${chunkCount}`,
        documentId,
        content: chunkContent,
        chunkIndex: chunkCount,
        wordCount: chunkWords.length,
      });

      chunkCount++;
      idx += chunkSizeWords - overlapWords;
      if (idx >= words.length || chunkWords.length < chunkSizeWords) break;
    }

    return chunks;
  }
}
