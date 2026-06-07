# RAG Demo — Architecture & Interview Guide

## What it demonstrates

A minimal **Retrieval-Augmented Generation** pipeline embedded in the Japanese Drama app:

1. **Corpus** — static documents in `lib/rag/corpus.ts` (grammar, scenarios, product tips)
2. **Chunking** — paragraph-aware splits with overlap (`lib/rag/chunk.ts`)
3. **Indexing** — in-memory TF-IDF + cosine similarity (`lib/rag/tfidf.ts`)
4. **Retrieve** — `POST /api/rag/retrieve` returns ranked chunks + scores
5. **Generate** — `POST /api/rag/generate` injects context into Groq LLM, streams answer with `[1]` citations

UI: `/rag` — shows pipeline steps, retrieved chunks, and streamed answer.

## Why TF-IDF (not vectors) for this demo

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

## Production upgrades (one-liners for HR/tech interview)

| Demo | Production |
|------|------------|
| In-memory TF-IDF | OpenAI/Cohere embeddings + vector DB |
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
