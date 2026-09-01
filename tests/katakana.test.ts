import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseKatakanaSegments, collectUnglossedTerms, isKatakanaTerm } from "@/lib/katakana"
import { parseJapaneseText } from "@/lib/japanese-text"
import { lookupLoanword, NON_LOANWORDS } from "@/lib/katakana-dict"

/** Render segments back to source text — nothing may be silently dropped. */
function roundTrip(text: string, glosses?: Map<string, string | null>) {
  return parseJapaneseText(text, glosses)
    .map((s) =>
      s.type === "text"
        ? s.text
        : s.type === "ruby"
          ? `${s.kanji}(${s.reading})${s.okurigana}`
          : s.term
    )
    .join("")
}

const glossed = (text: string, glosses?: Map<string, string | null>) =>
  parseJapaneseText(text, glosses)
    .filter((s) => s.type === "katakana" && s.gloss)
    .map((s) => (s.type === "katakana" ? `${s.term}=${s.gloss}` : ""))

describe("dictionary lookup", () => {
  test("returns the source word for a loanword", () => {
    assert.equal(lookupLoanword("コンビニ")?.en, "convenience (store)")
  })

  test("marks non-English origins so learners are not misled", () => {
    const e = lookupLoanword("ゲレンデ")
    assert.equal(e?.src, "de")
    assert.match(e!.en, /Gelände/)
  })

  test("blocklisted terms never resolve, even if spelled like a word", () => {
    assert.equal(lookupLoanword("ドキドキ"), null)
    assert.equal(lookupLoanword("カタカナ"), null)
  })
})

describe("segmentation", () => {
  test("annotates loanwords in a sentence", () => {
    assert.deepEqual(glossed("コンビニでサンドイッチを買(か)った。"), [
      "コンビニ=convenience (store)",
      "サンドイッチ=sandwich",
    ])
  })

  test("prefers the fewest-terms cover, so compounds win over their parts", () => {
    // アイス + コーヒー are both in the dictionary; the compound must win.
    assert.deepEqual(glossed("アイスコーヒー"), ["アイスコーヒー=iced coffee"])
  })

  test("keeps an unknown compound whole instead of shredding it", () => {
    // Regression: greedy scanning matched コース ("course") inside
    // ジェットコースター and emitted ジェット + コース + ター.
    const segs = parseKatakanaSegments("ジェットコースター")
    assert.equal(segs.length, 1)
    assert.equal(segs[0].type === "katakana" && segs[0].term, "ジェットコースター")
    assert.equal(segs[0].type === "katakana" && segs[0].status, "pending")
  })

  test("splits compound loanwords on the middle dot", () => {
    assert.deepEqual(glossed("アイス・コーヒー"), ["アイス=ice", "コーヒー=coffee"])
  })

  test("never drops characters", () => {
    for (const s of [
      "コンビニでアイスコーヒーを買(か)いました。",
      "ゲレンデでスノーボードのレッスンを受(う)けます。",
      "ドキドキしながらリフトに乗(の)った。",
      "アイス・コーヒーをください。",
      "食(た)べ物(もの)はカレーです。",
      "ヤバイ、スマホのバッテリーがない。",
    ]) {
      assert.equal(roundTrip(s), s, `round-trip failed for: ${s}`)
    }
  })

  test("single katakana characters are left alone", () => {
    const segs = parseKatakanaSegments("ヨ")
    assert.equal(segs[0].type, "text")
  })
})

describe("status: why a term shows no English", () => {
  test("kana-chart rows are 'checked', not 'pending'", () => {
    // A learning app prints these constantly; they must not cost a lookup.
    for (const row of ["アイウエオ", "カキクケコ", "パピプペポ"]) {
      const segs = parseKatakanaSegments(row)
      assert.equal(segs[0].type === "katakana" && segs[0].status, "checked", row)
    }
  })

  test("onomatopoeia and native katakana are 'checked'", () => {
    for (const w of ["ドキドキ", "ヤバイ", "カタカナ"]) {
      const segs = parseKatakanaSegments(w)
      assert.equal(segs[0].type === "katakana" && segs[0].status, "checked", w)
    }
  })

  test("a term the model answered null for flips pending -> checked", () => {
    const before = parseKatakanaSegments("ヨドバシカメラ")
    assert.equal(before[0].type === "katakana" && before[0].status, "pending")

    const after = parseKatakanaSegments("ヨドバシカメラ", new Map([["ヨドバシカメラ", null]]))
    assert.equal(after[0].type === "katakana" && after[0].status, "checked")
  })

  test("a resolved gloss is used and marked glossed", () => {
    const segs = parseKatakanaSegments(
      "ジェットコースター",
      new Map([["ジェットコースター", "jet coaster"]])
    )
    assert.equal(segs[0].type === "katakana" && segs[0].gloss, "jet coaster")
    assert.equal(segs[0].type === "katakana" && segs[0].status, "glossed")
  })
})

describe("gloss request batching", () => {
  test("asks only about terms with no answer yet", () => {
    assert.deepEqual(
      collectUnglossedTerms("ジェットコースターに乗りたい。", new Map()),
      ["ジェットコースター"]
    )
  })

  test("never re-asks about a term already answered null", () => {
    // Regression: caching absence as null used to be indistinguishable from a
    // failed lookup, causing either infinite retries or permanent suppression.
    assert.deepEqual(
      collectUnglossedTerms("ジェットコースター", new Map([["ジェットコースター", null]])),
      []
    )
  })

  test("never asks about dictionary words or blocklisted terms", () => {
    assert.deepEqual(
      collectUnglossedTerms("コンビニでドキドキしながらアイウエオ", new Map()),
      []
    )
  })
})

describe("furigana and katakana layers coexist", () => {
  test("readings survive alongside loanword glosses", () => {
    const segs = parseJapaneseText("スキー場(じょう)のパウダースノーは最高(さいこう)。")
    const ruby = segs.filter((s) => s.type === "ruby")
    const kata = segs.filter((s) => s.type === "katakana" && s.gloss)
    assert.equal(ruby.length, 2)
    assert.equal(kata.length, 2)
  })

  test("isKatakanaTerm rejects non-katakana input", () => {
    assert.ok(isKatakanaTerm("コンビニ"))
    assert.ok(!isKatakanaTerm("漢字"))
    assert.ok(!isKatakanaTerm("abc"))
    assert.ok(!isKatakanaTerm("ひらがな"))
  })

  test("the blocklist contains only katakana", () => {
    for (const w of NON_LOANWORDS) {
      assert.ok(isKatakanaTerm(w), `blocklist entry is not katakana: ${w}`)
    }
  })
})
