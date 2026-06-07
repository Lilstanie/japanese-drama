import type { RagChunk } from "./types"

/** Tokenize mixed JP/CN/EN text for lexical retrieval. */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = text.toLowerCase()

  for (const w of lower.match(/[a-z0-9]+/g) ?? []) {
    if (w.length > 1) tokens.push(w)
  }

  const cjkSegments = text.match(/[\u3040-\u30ff\u4e00-\u9fff]+/g) ?? []
  for (const seg of cjkSegments) {
    for (const ch of seg) tokens.push(ch)
    for (let i = 0; i < seg.length - 1; i++) {
      tokens.push(seg.slice(i, i + 2))
    }
  }

  return tokens
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1)
  }
  const len = tokens.length || 1
  for (const [k, v] of tf) {
    tf.set(k, v / len)
  }
  return tf
}

function vectorNorm(vec: Map<string, number>): number {
  let sum = 0
  for (const v of vec.values()) sum += v * v
  return Math.sqrt(sum) || 1
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  for (const [term, av] of a) {
    const bv = b.get(term)
    if (bv) dot += av * bv
  }
  return dot / (vectorNorm(a) * vectorNorm(b))
}

export type TfidfIndex = {
  chunks: RagChunk[]
  vectors: Map<string, number>[]
  idf: Map<string, number>
}

export function buildTfidfIndex(chunks: RagChunk[]): TfidfIndex {
  const docTokens = chunks.map((c) => tokenize(c.text))
  const df = new Map<string, number>()
  const n = chunks.length || 1

  for (const tokens of docTokens) {
    const unique = new Set(tokens)
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  for (const [term, count] of df) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1)
  }

  const vectors = docTokens.map((tokens) => {
    const tf = termFrequency(tokens)
    const vec = new Map<string, number>()
    for (const [term, freq] of tf) {
      vec.set(term, freq * (idf.get(term) ?? 1))
    }
    return vec
  })

  return { chunks, vectors, idf }
}

export function vectorizeQuery(query: string, idf: Map<string, number>): Map<string, number> {
  const tf = termFrequency(tokenize(query))
  const vec = new Map<string, number>()
  for (const [term, freq] of tf) {
    vec.set(term, freq * (idf.get(term) ?? 1))
  }
  return vec
}

export function searchTfidf(
  index: TfidfIndex,
  query: string,
  topK: number,
): { chunk: RagChunk; score: number }[] {
  const qVec = vectorizeQuery(query, index.idf)
  const scored = index.chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(qVec, index.vectors[i]!),
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored
    .filter((s) => s.score > 0.01)
    .slice(0, topK)
}
