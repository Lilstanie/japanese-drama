import type { RagChunk } from "./types"

/**
 * Function words that carry no retrieval signal.
 *
 * Character-level tokenisation made these look like content: the query
 * 「は和が有什么区别」 was matching a product-tips document because that
 * document happens to contain 「什么」 and 「有」 — the interrogative words, not
 * the subject. Both the characters and the bigrams they form are dropped.
 */
const STOPWORDS = new Set([
  // Chinese function words and interrogatives
  "的", "了", "是", "在", "有", "和", "也", "都", "就", "很", "太", "不",
  "我", "你", "他", "她", "它", "这", "那", "哪", "个", "们", "吗", "呢",
  "吧", "啊", "什", "么", "怎", "样", "为", "还", "要", "会", "能", "可",
  "什么", "怎么", "怎样", "为什", "没有", "可以", "一个", "这个", "那个",
])

// Japanese particles are deliberately absent: in a corpus about Japanese
// grammar they are the subject matter, not noise. Adding は and が dropped
// hit@1 to 53% and made 「は和が的区别」 — the example query in the docs —
// return nothing at all.

/** Tokenize mixed JP/CN/EN text for lexical retrieval. */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = text.toLowerCase()

  for (const w of lower.match(/[a-z0-9]+/g) ?? []) {
    if (w.length > 1) tokens.push(w)
  }

  const cjkSegments = text.match(/[\u3040-\u30ff\u4e00-\u9fff]+/g) ?? []
  for (const seg of cjkSegments) {
    for (const ch of seg) {
      if (!STOPWORDS.has(ch)) tokens.push(ch)
    }
    for (let i = 0; i < seg.length - 1; i++) {
      const bigram = seg.slice(i, i + 2)
      if (!STOPWORDS.has(bigram)) tokens.push(bigram)
    }
  }

  return tokens
}




export type TfidfIndex = {
  chunks: RagChunk[]
  /** Inverse document frequency per term. */
  idf: Map<string, number>
  /** Raw term counts per chunk — BM25 needs unnormalised frequencies. */
  counts: Map<string, number>[]
  /** Token count per chunk, and the mean, for length normalisation. */
  lengths: number[]
  avgLength: number
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

  const counts = docTokens.map((tokens) => {
    const c = new Map<string, number>()
    for (const t of tokens) c.set(t, (c.get(t) ?? 0) + 1)
    return c
  })
  const lengths = docTokens.map((t) => t.length)
  const avgLength = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1)

  return { chunks, idf, counts, lengths, avgLength }
}


/**
 * BM25 tuning. k1 caps how much repeating a term can help; b controls how
 * strongly a longer document is penalised.
 */
const BM25_K1 = 1.2
const BM25_B = 0.75

/**
 * Rank with BM25 rather than TF-IDF cosine.
 *
 * Cosine treats a term appearing five times as five times as relevant, which on
 * a character-tokenised corpus lets a document win on repetition of a common
 * character. BM25 saturates that, and normalises length explicitly.
 */
export function searchTfidf(
  index: TfidfIndex,
  query: string,
  topK: number,
): { chunk: RagChunk; score: number }[] {
  const queryTerms = new Set(tokenize(query))
  if (queryTerms.size === 0) return []

  const scored = index.chunks.map((chunk, i) => {
    const counts = index.counts[i]!
    const len = index.lengths[i]!
    let score = 0

    for (const term of queryTerms) {
      const freq = counts.get(term)
      if (!freq) continue
      const idf = index.idf.get(term) ?? 1
      const norm = 1 - BM25_B + BM25_B * (len / (index.avgLength || 1))
      score += idf * ((freq * (BM25_K1 + 1)) / (freq + BM25_K1 * norm))
    }

    // Normalised by query size so scores stay comparable across queries, which
    // the UI shows and the 0.01 floor depends on.
    return { chunk, score: score / queryTerms.size }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.filter((s) => s.score > 0.01).slice(0, topK)
}
