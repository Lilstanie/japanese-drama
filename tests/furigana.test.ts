import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseFuriganaSegments, normalizeFurigana } from "@/lib/furigana"
import { toSpeechText } from "@/lib/tts"
import { parseJapaneseText } from "@/lib/japanese-text"
import { convertToRomaji } from "@/lib/romaji"

const rubies = (text: string) =>
  parseFuriganaSegments(text).filter((s) => s.type === "ruby")

describe("furigana parsing", () => {
  test("splits a reading from its kanji", () => {
    const [r] = rubies("重心(じゅうしん)を前に")
    assert.equal(r.type === "ruby" && r.kanji, "重心")
    assert.equal(r.type === "ruby" && r.reading, "じゅうしん")
  })

  test("keeps okurigana out of the ruby base", () => {
    // 食べ物(たべもの): the reading covers the whole word, and 物 is not okurigana.
    const [r] = rubies("食べ物(たべもの)")
    assert.equal(r.type === "ruby" && r.kanji, "食べ物")
    assert.equal(r.type === "ruby" && r.okurigana, "")
  })

  test("does not capture hiragana before the kanji", () => {
    // ちょっと難(むずか) must annotate 難 alone, not ちょっと難.
    const [r] = rubies("ちょっと難(むずか)しい")
    assert.equal(r.type === "ruby" && r.kanji, "難")
  })

  test("text with no furigana yields no ruby", () => {
    assert.equal(rubies("こんにちは").length, 0)
  })
})

describe("full-width parentheses", () => {
  // Regression: the models write furigana in either width — the podcast's own
  // system prompt is Japanese, where （） is conventional — and matching only
  // `(` silently broke ruby, romaji and speech all at once.

  test("normalises a full-width reading to half-width", () => {
    assert.equal(normalizeFurigana("重心（じゅうしん）"), "重心(じゅうしん)")
  })

  test("leaves full-width parens alone when they are not a reading", () => {
    // Only kana contents are furigana; a real parenthetical must survive.
    assert.equal(normalizeFurigana("会議（重要）"), "会議（重要）")
  })

  test("both widths produce the same ruby", () => {
    assert.equal(rubies("重心（じゅうしん）を前に").length, 1)
    assert.equal(
      rubies("重心（じゅうしん）を前に").length,
      rubies("重心(じゅうしん)を前に").length
    )
  })

  test("both widths produce the same romaji", () => {
    assert.equal(
      convertToRomaji("重心（じゅうしん）を前に"),
      convertToRomaji("重心(じゅうしん)を前に")
    )
  })

  test("both widths produce the same spoken text", () => {
    // The real symptom: an unstripped reading was read aloud a second time.
    assert.equal(toSpeechText("重心（じゅうしん）を前に"), "重心を前に")
    assert.equal(toSpeechText("重心(じゅうしん)を前に"), "重心を前に")
  })
})

describe("text prepared for speech", () => {
  test("removes the reading so it is not spoken twice", () => {
    assert.equal(toSpeechText("食べ物(たべもの)がすき"), "食べ物がすき")
  })

  test("keeps a genuine parenthetical", () => {
    // Only kana contents are furigana. Dropping anything else would silently
    // remove words from what the learner hears.
    assert.equal(
      toSpeechText("コーヒー(coffee)をください"),
      "コーヒー(coffee)をください"
    )
  })

  test("the scene and the podcast prepare text identically", () => {
    // Both used to have their own implementation, and they disagreed on both
    // paren width and non-kana contents.
    for (const s of [
      "重心（じゅうしん）を前に",
      "食べ物(たべもの)がすき",
      "コーヒー(coffee)をください",
      "曲(ま)がって",
    ]) {
      assert.equal(toSpeechText(s), toSpeechText(s))
      assert.ok(!/[（(][ぁ-んァ-ヺー]+[)）]/.test(toSpeechText(s)), s)
    }
  })
})

describe("annotation layers do not interfere", () => {
  test("a katakana loanword still resolves next to full-width furigana", () => {
    const segs = parseJapaneseText("重心（じゅうしん）とスノーボード")
    assert.equal(segs.filter((s) => s.type === "ruby").length, 1)
    assert.ok(
      segs.some((s) => s.type === "katakana" && s.gloss === "snowboard")
    )
  })
})
