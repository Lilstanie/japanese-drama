import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { retrieve, getRagStats, formatChunksForPrompt } from "@/lib/rag/index"
import { tokenize } from "@/lib/rag/tfidf"

/**
 * The RAG demo is shown to people, so the property worth testing is relevance —
 * that a question retrieves the document that answers it — not merely that the
 * call returns something.
 */

describe("index", () => {
  test("builds over the whole corpus", () => {
    const stats = getRagStats()
    assert.ok(stats.documentCount >= 8, "corpus shrank unexpectedly")
    assert.ok(stats.chunkCount >= stats.documentCount, "chunks < documents")
    assert.ok(stats.categories.length >= 3)
    assert.equal(stats.retriever, "tfidf")
  })
})

describe("tokenizer", () => {
  test("indexes CJK as characters and bigrams", () => {
    // Bigrams are what let 「居酒屋」 match without a word segmenter.
    const t = tokenize("助詞")
    assert.ok(t.includes("助") && t.includes("詞"), "missing characters")
    assert.ok(t.includes("助詞"), "missing bigram")
  })

  test("keeps latin words but drops single letters", () => {
    const t = tokenize("JLPT n5 a")
    assert.ok(t.includes("jlpt"))
    assert.ok(t.includes("n5"))
    assert.ok(!t.includes("a"), "single letters are noise")
  })

  test("ignores punctuation", () => {
    assert.deepEqual(tokenize("！？。、"), [])
  })
})

describe("retrieval relevance", () => {
  const topDoc = (q: string) => retrieve(q, 4)[0]?.documentId

  test("a particle question retrieves the particle document", () => {
    assert.equal(topDoc("は和が有什么区别"), "particles-wa-ga")
  })

  test("a location-particle question retrieves the right one of two similar docs", () => {
    // particles-wa-ga and particles-ni-de are near-duplicates in shape; picking
    // between them is the actual test of the retriever.
    assert.equal(topDoc("に和で怎么用"), "particles-ni-de")
  })

  test("a scenario question retrieves the scenario document", () => {
    assert.equal(topDoc("车站问路"), "station-scenario")
  })

  test("居酒屋点菜怎么说 reaches the izakaya document, though not first", () => {
    // Known gap, asserted honestly rather than aspirationally: keigo-basics
    // outranks it, which is defensible — ordering politely IS keigo — but the
    // scenario document is the better answer. It is in the top 3; the golden
    // set holds the overall bar.
    const ids = retrieve("居酒屋点菜怎么说", 3).map((h) => h.documentId)
    assert.ok(ids.includes("izakaya-scenario"), `got ${ids.join(", ")}`)
  })

  test("results are ranked by descending score", () => {
    const hits = retrieve("助词", 4)
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i - 1].score >= hits[i].score, "scores out of order")
    }
    assert.deepEqual(hits.map((h) => h.rank), hits.map((_, i) => i + 1))
  })

  test("topK is respected", () => {
    assert.ok(retrieve("日本語", 2).length <= 2)
    assert.ok(retrieve("日本語", 6).length <= 6)
  })

  test("a query matching nothing returns no hits rather than throwing", () => {
    // Latin nonsense shares no character bigrams with a CJK corpus.
    assert.deepEqual(retrieve("zzzz qqqq vvvv", 4), [])
  })

  test("an empty query is handled", () => {
    assert.doesNotThrow(() => retrieve("", 4))
    assert.doesNotThrow(() => retrieve("   ", 4))
  })
})

/**
 * Golden set — the eval docs/RAG_DEMO.md proposes ("hit rate@k on a golden set
 * of questions vs expected doc ids"), as a test so retrieval quality cannot
 * regress unnoticed.
 *
 * Thresholds sit just under the measured result rather than at it, so ordinary
 * corpus edits do not fail the build while a real regression still does.
 */
const GOLDEN: [question: string, expected: string][] = [
  ["は和が的区别", "particles-wa-ga"],
  ["は和が有什么区别", "particles-wa-ga"],
  ["什么时候用は什么时候用が", "particles-wa-ga"],
  ["に和で怎么用", "particles-ni-de"],
  ["に和で的区别", "particles-ni-de"],
  ["て形怎么变", "te-form"],
  ["て形的用法", "te-form"],
  ["敬语怎么用", "keigo-basics"],
  ["尊敬语和谦让语", "keigo-basics"],
  ["居酒屋点菜怎么说", "izakaya-scenario"],
  ["居酒屋怎么结账", "izakaya-scenario"],
  ["车站问路", "station-scenario"],
  ["在车站怎么买票", "station-scenario"],
  ["N5 单词", "jlpt-n5-vocab"],
  ["中文母语者常犯的错误", "chinese-learner-mistakes"],
]

describe("retrieval quality (golden set)", () => {
  const hits = (k: number) =>
    GOLDEN.filter(([q, want]) => retrieve(q, k).map((h) => h.documentId).includes(want)).length

  test("the right document ranks first for most questions", () => {
    // Measured 13/15 with BM25 + Chinese stopwords, up from 10/15 on the
    // original TF-IDF cosine.
    const top1 = GOLDEN.filter(([q, want]) => retrieve(q, 1)[0]?.documentId === want).length
    assert.ok(top1 >= 12, `hit@1 dropped to ${top1}/${GOLDEN.length}`)
  })

  test("the right document is always in the top 3", () => {
    const top3 = hits(3)
    assert.equal(top3, GOLDEN.length, `hit@3 dropped to ${top3}/${GOLDEN.length}`)
  })

  test("the query printed in the docs works", () => {
    // docs/RAG_DEMO.md tells the reader to run this one.
    assert.equal(retrieve("は和が的区别", 1)[0]?.documentId, "particles-wa-ga")
  })
})

describe("stopwords", () => {
  test("Chinese interrogatives are dropped", () => {
    // 「有什么」 was matching a product-tips document that happens to contain
    // those words, outranking the grammar document the question was about.
    const t = tokenize("有什么区别")
    assert.ok(!t.includes("什"), "什 should be a stopword")
    assert.ok(!t.includes("什么"), "什么 should be a stopword")
    assert.ok(t.includes("区别"), "区别 carries the meaning and must survive")
  })

  test("Japanese particles are NOT stopwords", () => {
    // They are the subject matter here. Removing them dropped hit@1 to 53% and
    // made the docs' own example query return nothing.
    const t = tokenize("はとが")
    assert.ok(t.includes("は") && t.includes("が"))
  })
})

describe("prompt formatting", () => {
  test("numbers sources so the model can cite them", () => {
    // The UI promises [1]-style citations; they come from this numbering.
    const prompt = formatChunksForPrompt(retrieve("は和が的区别", 2))
    assert.match(prompt, /\[1\]/)
    assert.match(prompt, /来源:/)
  })

  test("no chunks yields an empty prompt, not the word undefined", () => {
    assert.equal(formatChunksForPrompt([]), "")
  })
})
