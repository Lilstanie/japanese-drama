# RAG Demo — Architecture & Interview Guide

## What it demonstrates

A minimal **Retrieval-Augmented Generation** pipeline embedded in the Japanese Drama app:

1. **Corpus** — static documents in `lib/rag/corpus.ts` (grammar, scenarios, product tips)
2. **Chunking** — paragraph-aware splits with overlap (`lib/rag/chunk.ts`)
3. **Indexing** — in-memory BM25 over character + bigram tokens, with a Chinese
   stopword list (`lib/rag/tfidf.ts`)
4. **Retrieve** — `POST /api/rag/retrieve` returns ranked chunks + scores
5. **Generate** — `POST /api/rag/generate` injects context into Groq LLM, streams answer with `[1]` citations

UI: `/rag` — shows pipeline steps, retrieved chunks, and streamed answer.

## Retrieval quality

Measured with a 15-question golden set (`tests/rag.test.ts`), the eval this doc
proposes below:

| Retriever | hit@1 | hit@3 |
|-----------|-------|-------|
| TF-IDF cosine, no stopwords (original) | 67% | 100% |
| + Chinese stopwords | 80% | 100% |
| + BM25 ranking (current) | **87%** | **100%** |

Two findings behind those numbers:

**Chinese interrogatives were being scored as content.** Character-level
tokenisation made 「有什么」 a match, so 「は和が有什么区别」 retrieved a
product-tips document that happens to contain those words — including the
example query printed in this file.

**Japanese particles must NOT be stopwords.** Adding は and が to the list — the
obvious move if you copy a generic CJK stopword list — dropped hit@1 to 53% and
made 「は和が的区别」 return nothing at all. In a corpus about Japanese grammar,
the particles are the subject matter.

BM25 replaced cosine because cosine treats a term appearing five times as five
times as relevant, which on character tokens lets repetition of a common
character win. Its length-normalisation term is currently inert — chunks are all
113–214 tokens — so the gain came from term saturation; the normalisation starts
mattering if chunk sizes diverge.

Known gap: 「居酒屋点菜怎么说」 ranks `keigo-basics` first. Defensible (ordering
politely *is* keigo) but `izakaya-scenario` is the better answer; it is in the
top 3.

## Why lexical retrieval (not vectors) for this demo

- **Zero extra API keys** — runs with only `GROQ_API_KEY`
- **Transparent** — scores are inspectable in the UI (good for live demos)
- **Easy to explain** in interviews: "I'd swap the retriever for embeddings + pgvector in production"

## API contract

### `GET /api/rag/stats`

```json
{
  "documentCount": 12,
  "chunkCount": 15,
  "categories": ["语法", "场景", "..."],
  "retriever": "tfidf"
}
```

### `POST /api/rag/retrieve`

```json
{ "query": "は和が的区别", "topK": 4 }
```

Response:

```json
{
  "query": "...",
  "topK": 4,
  "retriever": "tfidf",
  "chunks": [
    {
      "id": "particles-wa-ga#0",
      "documentId": "particles-wa-ga",
      "documentTitle": "助词「は」与「が」",
      "category": "语法",
      "text": "...",
      "chunkIndex": 0,
      "score": 0.42,
      "rank": 1
    }
  ]
}
```

### `POST /api/rag/generate`

```json
{ "query": "...", "chunks": [ /* optional, from retrieve */ ] }
```

Returns `text/plain` streamed body. If `chunks` omitted, server re-retrieves.

## File map

| Path | Role |
|------|------|
| `lib/rag/corpus.ts` | Knowledge documents |
| `lib/rag/chunk.ts` | Text splitting |
| `lib/rag/tfidf.ts` | Tokenize, index, search |
| `lib/rag/index.ts` | Singleton index + `retrieve()` |
| `app/api/rag/retrieve/route.ts` | Retrieval endpoint |
| `app/api/rag/generate/route.ts` | Augmented generation |
| `components/RagDemo.tsx` | Demo UI |

## Extending to an AI Agent (talking points)

```text
User message
    ↓
Agent (LLM + tools)
    ├─ tool: search_knowledge_base(query) → same as /api/rag/retrieve
    ├─ tool: answer_with_context(query, chunk_ids) → /api/rag/generate
    └─ optional: escalate_to_human / log_feedback
```

Patterns to mention:

- **ReAct** — reason → act (call retrieve) → observe chunks → answer
- **Function calling** — Groq/OpenAI tool schema for `search_knowledge_base`
- **Guardrails** — system prompt: answer only from context; cite sources
- **Eval** — hit rate@k on a golden set of questions vs expected doc ids
  (implemented: `tests/rag.test.ts`, run with `npm test`)

## Production upgrades (one-liners for HR/tech interview)

| Demo | Production |
|------|------------|
| In-memory BM25 | OpenAI/Cohere embeddings + vector DB |
| Static `corpus.ts` | PDF/Markdown ingest pipeline + cron reindex |
| Split retrieve/generate APIs | Single agent orchestrator with tracing (Langfuse, etc.) |
| No cache | Semantic cache for repeated queries |

## Local test

```bash
npm run dev
# Open http://localhost:3000/rag

curl -s http://localhost:3000/api/rag/stats | jq

curl -s -X POST http://localhost:3000/api/rag/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query":"居酒屋怎么结账","topK":3}' | jq
```
