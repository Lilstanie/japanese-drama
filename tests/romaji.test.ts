import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { convertToRomaji } from "@/lib/romaji"

describe("kanji conversion", () => {
  test("reads kanji from the furigana already in the text", () => {
    // Regression: the old regex required the base to be kanji-only, so
    // 食べ物(たべもの) fell through and rendered as "食be物".
    assert.equal(convertToRomaji("食べ物(たべもの)"), "tabemono")
    assert.equal(convertToRomaji("重心(じゅうしん)"), "juushin")
  })

  test("never leaves half-converted kanji in the output", () => {
    const out = convertToRomaji("食べ物(たべもの)はカレーです。")
    assert.ok(!/[一-龯]/.test(out), `kanji left in output: ${out}`)
  })

  test("falls back to the common-word dictionary when unannotated", () => {
    assert.equal(convertToRomaji("私"), "watashi")
    assert.equal(convertToRomaji("今日"), "kyou")
    assert.equal(convertToRomaji("駅"), "eki")
  })

  test("leaves genuinely unknown kanji visible rather than dropping them", () => {
    // Silently deleting text a learner can see would be worse than admitting
    // we could not read it.
    assert.match(convertToRomaji("薔薇"), /薔薇/)
  })
})

describe("word spacing", () => {
  test("separates words instead of emitting one run of letters", () => {
    const out = convertToRomaji("食べ物(たべもの)はカレーです。")
    assert.equal(out, "tabemono wa karee desu.")
    assert.ok(out.includes(" "))
  })

  test("splits particles off the words they follow", () => {
    assert.equal(
      convertToRomaji("アイスコーヒーをください。"),
      "aisukoohii o kudasai."
    )
  })

  test("does not split a word that merely starts with particle kana", () => {
    // です begins with で, which is a particle — "de su" would be wrong.
    assert.equal(convertToRomaji("です"), "desu")
  })
})

describe("particle pronunciation", () => {
  test("は as a topic particle is read wa", () => {
    assert.match(convertToRomaji("私(わたし)は"), /\bwa\b/)
    assert.ok(!convertToRomaji("私(わたし)は").includes("ha"))
  })

  test("へ as a direction particle is read e", () => {
    assert.equal(convertToRomaji("コンビニへ"), "konbini e")
  })

  test("は inside a word keeps its normal sound", () => {
    // はい is a word, not a particle — it must stay "hai".
    assert.equal(convertToRomaji("はい"), "hai")
  })
})

describe("okurigana attached to a one-kana reading", () => {
  test("keeps a verb stem together with its ending", () => {
    // Regression: 曲(ま)がって came out as "ma ga tte" because が was treated
    // as a particle and the stem was split from its okurigana.
    assert.equal(convertToRomaji("曲(ま)がって"), "magatte")
    assert.equal(convertToRomaji("会(あ)いました"), "aimashita")
    assert.equal(convertToRomaji("受(う)けます"), "ukemasu")
  })

  test("but a noun reading still takes a following particle separately", () => {
    // 足(あし) is a noun; に after it is a particle, not okurigana.
    assert.equal(convertToRomaji("足(あし)に"), "ashi ni")
    assert.equal(convertToRomaji("前(まえ)の"), "mae no")
  })

  test("splits a trailing auxiliary into its own word", () => {
    assert.equal(convertToRomaji("曲(ま)がってください"), "magatte kudasai")
  })
})

describe("word segmentation", () => {
  test("separates a kana verb from the noun before it", () => {
    // Regression: 何かお手伝いできることはありますか came out as
    // "nani kao tetsuda idekirukotohaarimasuka".
    assert.equal(
      convertToRomaji("何(なに)かお手伝(てつだ)いできることはありますか？"),
      "nani ka otetsudai dekiru koto wa arimasu ka?"
    )
  })

  test("a word wins over a particle that starts it", () => {
    // で is a particle, but です and できる are words — matching the particle
    // first produced "de su" and "de kiru".
    assert.equal(convertToRomaji("これはペンです。"), "kore wa pen desu.")
    assert.equal(convertToRomaji("できる"), "dekiru")
  })

  test("but a particle wins directly after a content word", () => {
    // 今日はいい must not be read as 今日 + はい + い.
    assert.equal(
      convertToRomaji("今日(きょう)はいい天気(てんき)です。"),
      "kyou wa ii tenki desu."
    )
  })

  test("standalone はい is still the word, not a particle", () => {
    assert.equal(convertToRomaji("はい"), "hai")
  })

  test("sentence-final particles do not match mid-word", () => {
    // か begins かけて; it is only a particle at the end of a clause.
    assert.equal(convertToRomaji("足(あし)にかけて"), "ashi ni kakete")
    assert.equal(convertToRomaji("行(い)きませんか"), "ikimasen ka")
  })

  test("honorific prefixes attach to the word after them", () => {
    assert.equal(convertToRomaji("お手伝(てつだ)い"), "otetsudai")
    assert.equal(convertToRomaji("何(なに)をお探(さが)しですか。"), "nani o osagashi desu ka.")
  })

  test("a word annotated in two pieces is joined", () => {
    // The model sometimes writes 食(た)べ物(もの) rather than 食べ物(たべもの).
    assert.equal(convertToRomaji("食(た)べ物(もの)"), "tabemono")
  })

  test("an unknown word stays in one piece", () => {
    // Better a single unfamiliar token than a string of stray syllables.
    assert.equal(convertToRomaji("ぬるぬる"), "nurunuru")
  })
})

describe("full sentences", () => {
  test("a scene line reads as spaced, fully-converted romaji", () => {
    assert.equal(
      convertToRomaji("重心(じゅうしん)を前(まえ)の足(あし)にかけて、ゆっくり曲(ま)がってください。"),
      "juushin o mae no ashi ni kakete, yukkuri magatte kudasai."
    )
  })

  test("katakana loanwords convert too", () => {
    assert.equal(
      convertToRomaji("ゲレンデでスノーボードのレッスンを受(う)けます。"),
      "gerende de sunooboodo no ressun o ukemasu."
    )
  })

  test("punctuation attaches to the preceding word", () => {
    assert.ok(!convertToRomaji("はい、そうです。").includes(" ,"))
    assert.ok(!convertToRomaji("はい、そうです。").includes(" ."))
  })
})
