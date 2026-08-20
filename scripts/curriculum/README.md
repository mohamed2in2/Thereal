# Curriculum ingestion pipeline

Turns the official Egyptian Baccalaureate PDFs into a retrieval knowledge base
the AI answers from.

```
PDF -> text extraction -> cleaning -> structure detection -> chunking
    -> metadata -> embeddings -> vector store -> retrieval-augmented answers
```

## Running it

```bash
npm run curriculum:ingest   # PDFs  -> curriculum_chunks.json + curriculum_structure.json
npm run curriculum:embed    # chunks -> curriculum_vectors.json  (needs GEMINI_API_KEY)
npm run curriculum:test     # retrieval acceptance tests
npm run curriculum:build    # all three
```

Both stages are idempotent. Chunk ids are derived from their content, so
re-ingesting unchanged PDFs reproduces byte-identical output and the embedding
step re-uses every existing vector (it only calls the API for new or changed
chunks, and drops vectors whose chunk no longer exists).

## Why the extractor is custom

`page.get_text()` is unusable on these files, for two independent reasons:

1. It **drops any Arabic letter carrying a diacritic**, leaving the bare mark
   behind — `عامًا` came out as `عاًا`, `وغيّرت` as `وغّرت`. `get_texttrace()`
   keeps them.
2. Glyphs are stored in visual placement order, so words came out reversed and
   lam-alef ligatures decomposed backwards (`الاجتماعي` -> `االجتماعي`).

`arabic_pdf.py` therefore reads glyphs with `get_texttrace()` and rebuilds
logical order from geometry: right-to-left by glyph origin, combining marks
re-attached to the nearest base letter, embedded Latin/digit runs flipped back
to left-to-right, and mirrored brackets restored.

## Modules

| File | Responsibility |
| --- | --- |
| `arabic_pdf.py` | Glyph-level extraction and RTL reconstruction |
| `clean.py` | Normalisation, header/footer removal, paragraph and column rebuilding |
| `markers.py` | The section markers the book uses (`⭐ الخلاصة`, `✎ مثال محلول`, …) |
| `structure.py` | Table of contents parsing and per-page lesson assignment |
| `chunk.py` | Semantic chunking and metadata |
| `ingest.py` | Orchestration and the post-ingestion validation report |
| `embed.mjs` | Gemini embeddings, resumable and idempotent |
| `test-retrieval.ts` | Retrieval acceptance tests |

## Adding another curriculum

Add an entry to `VOLUMES` in `ingest.py` with its term, source name and file,
and adjust `BASE_META` for the subject and grade. The structure detector keys
off the book's own running heads and contents page, so a textbook laid out the
same way needs no new code. Everything downstream — chunk schema, embeddings,
retrieval, grounding — is curriculum-agnostic.

## Known limitations

- Multiple-choice option labels (أ/ب/ج/د) sit in their own narrow layout column,
  so they occasionally attach to the neighbouring option's text inside
  `solved_example` and `exercises` chunks. The option text itself is intact.
- Diagrams are images; only their captions are indexed.
- Pages 13-14 of part 1 are blank in the source PDF.
