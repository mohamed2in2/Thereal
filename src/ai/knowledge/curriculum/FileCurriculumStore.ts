/**
 * Loads the ingested curriculum from disk into the process.
 *
 * The knowledge base is small (a few hundred chunks per curriculum), so it is
 * bundled with the application rather than kept in Postgres: no extension, no
 * migration, and identical behaviour in development and production. Swap this
 * implementation for a database-backed CurriculumStore when several curricula
 * outgrow the process.
 */

import { promises as fs } from "fs";
import path from "path";

import { CurriculumChunk, CurriculumStore } from "./types";

const DATA_DIR = path.join(process.cwd(), "src", "ai", "knowledge", "curriculum");
const CHUNKS_FILE = path.join(DATA_DIR, "curriculum_chunks.json");
const VECTORS_FILE = path.join(DATA_DIR, "curriculum_vectors.json");

interface VectorFile {
  model: string;
  dimensions: number;
  vectors: Record<string, number[]>;
}

export class FileCurriculumStore implements CurriculumStore {
  private static instance: FileCurriculumStore | null = null;

  private chunks: CurriculumChunk[] = [];
  private vectors = new Map<string, Float32Array>();
  private loading: Promise<void> | null = null;
  private loaded = false;
  public vectorModel: string | null = null;
  public dimensions = 0;

  public static getInstance(): FileCurriculumStore {
    if (!FileCurriculumStore.instance) {
      FileCurriculumStore.instance = new FileCurriculumStore();
    }
    return FileCurriculumStore.instance;
  }

  public async ready(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) this.loading = this.load();
    await this.loading;
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(CHUNKS_FILE, "utf-8");
      this.chunks = JSON.parse(raw) as CurriculumChunk[];
    } catch {
      // No curriculum ingested yet: the AI simply runs without grounding.
      this.chunks = [];
    }

    try {
      const raw = await fs.readFile(VECTORS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as VectorFile;
      this.vectorModel = parsed.model;
      this.dimensions = parsed.dimensions;
      for (const [id, values] of Object.entries(parsed.vectors)) {
        this.vectors.set(id, Float32Array.from(values));
      }
    } catch {
      // Embeddings are optional; lexical retrieval still works without them.
      this.vectors.clear();
    }

    this.loaded = true;
  }

  public all(): CurriculumChunk[] {
    return this.chunks;
  }

  public size(): number {
    return this.chunks.length;
  }

  public vectorFor(chunkId: string): Float32Array | null {
    return this.vectors.get(chunkId) || null;
  }

  public hasVectors(): boolean {
    return this.vectors.size > 0;
  }
}
