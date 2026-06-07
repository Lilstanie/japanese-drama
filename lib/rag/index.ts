import { RAG_CORPUS } from "./corpus"
import { chunkDocuments } from "./chunk"
import { buildTfidfIndex, searchTfidf, type TfidfIndex } from "./tfidf"
import type { RagIndexStats, RetrievedChunk } from "./types"

let cachedIndex: TfidfIndex | null = null

function getIndex(): TfidfIndex {
  if (!cachedIndex) {
    const chunks = chunkDocuments(RAG_CORPUS)
    cachedIndex = buildTfidfIndex(chunks)
  }
  return cachedIndex
}

export function retrieve(query: string, topK = 4): RetrievedChunk[] {
  const index = getIndex()
  const hits = searchTfidf(index, query.trim(), topK)

  return hits.map((hit, i) => ({
    ...hit.chunk,
    score: Math.round(hit.score * 1000) / 1000,
    rank: i + 1,
  }))
}

export function getRagStats(): RagIndexStats {
  const index = getIndex()
  const categories = [...new Set(index.chunks.map((c) => c.category))]

  return {
    documentCount: RAG_CORPUS.length,
    chunkCount: index.chunks.length,
    categories,
    retriever: "tfidf",
  }
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] 来源: ${c.documentTitle}（${c.category}）\n${c.text}`,
    )
    .join("\n\n")
}
