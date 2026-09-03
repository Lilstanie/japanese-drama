import { toRomaji } from "wanakana"
import { parseJapaneseText } from "@/lib/japanese-text"

/**
 * Romaji transliteration for learners.
 *
 * Two things make a naive `toRomaji(text)` unusable here:
 *
 * 1. **Kanji have no reading of their own.** wanakana leaves them untouched, so
 *    「食べ物」 came out as "食be物". The readings we need are already in the
 *    text as furigana — 食べ物(たべもの) — so this converts via the parsed ruby
 *    segments instead of the raw string, and falls back to a small dictionary of
 *    very common words the model tends to leave unannotated.
 *
 * 2. **Japanese is written without spaces.** Transliterating a whole sentence
 *    produces one unbroken run of letters. Tokens are emitted separately and
 *    joined with spaces, which is what makes the output readable at all.
 */

/**
 * Readings for common words the model often writes without furigana. This is a
 * safety net, not a dictionary: the real fix is that the chat prompt now asks
 * for furigana on every kanji word. Anything still unknown is left as kanji
 * rather than silently dropped, so the learner can see what was not converted.
 */
const COMMON_READINGS: Record<string, string> = {
  私: "わたし", 僕: "ぼく", 俺: "おれ", 君: "きみ", 彼: "かれ", 彼女: "かのじょ",
  今日: "きょう", 明日: "あした", 昨日: "きのう", 今: "いま", 時間: "じかん",
  何: "なに", 何時: "なんじ", 誰: "だれ", 何処: "どこ", 人: "ひと", 方: "かた",
  日本: "にほん", 日本語: "にほんご", 英語: "えいご", 中国: "ちゅうごく",
  大丈夫: "だいじょうぶ", 有難う: "ありがとう", 御願: "おねが",
  店: "みせ", 駅: "えき", 道: "みち", 国: "くに", 家: "いえ", 車: "くるま",
  水: "みず", 火: "ひ", 山: "やま", 川: "かわ", 空: "そら", 雪: "ゆき",
  食: "た", 飲: "の", 見: "み", 聞: "き", 行: "い", 来: "き", 帰: "かえ",
  買: "か", 売: "う", 話: "はな", 読: "よ", 書: "か", 教: "おし", 習: "なら",
  好: "す", 嫌: "きら", 上手: "じょうず", 下手: "へた", 元気: "げんき",
  大: "おお", 小: "ちい", 高: "たか", 安: "やす", 新: "あたら", 古: "ふる",
  多: "おお", 少: "すく", 早: "はや", 遅: "おそ", 長: "なが", 短: "みじか",
  円: "えん", 一: "いち", 二: "に", 三: "さん", 四: "よん", 五: "ご",
  六: "ろく", 七: "なな", 八: "はち", 九: "きゅう", 十: "じゅう", 百: "ひゃく",
  千: "せん", 万: "まん", 年: "ねん", 月: "つき", 日: "ひ", 週: "しゅう",
  朝: "あさ", 昼: "ひる", 夜: "よる", 前: "まえ", 後: "あと", 中: "なか",
  外: "そと", 内: "うち", 上: "うえ", 下: "した", 右: "みぎ", 左: "ひだり",
  席: "せき", 味: "あじ", 熱: "あつ", 冷: "つめ", 気: "き", 事: "こと",
  物: "もの", 所: "ところ", 内容: "ないよう", 値段: "ねだん", 会計: "かいけい",
  注文: "ちゅうもん", 予約: "よやく", 案内: "あんない", 説明: "せつめい",
  練習: "れんしゅう", 質問: "しつもん",
}

/**
 * Particles are split off so a hiragana tail does not fuse into the word before
 * it ("wo kudasai", not "wokudasai").
 */
const PARTICLES = new Set([
  "は", "が", "を", "に", "へ", "で", "と", "も", "の", "や", "か", "ね", "よ",
  "から", "まで", "より", "など", "でも", "けど", "のに", "ので", "ばかり",
])

/**
 * Particles whose pronunciation differs from their spelling. は is read "wa"
 * and へ "e" only when used as particles — inside a word (はい, へや) they keep
 * their normal sound, which is why this is applied to standalone particle
 * tokens rather than by string replacement.
 */
const PARTICLE_ROMAJI: Record<string, string> = {
  "は": "wa",
  "へ": "e",
  "を": "o",
}

/** Auxiliaries conventionally written as their own word in romaji. */
const TRAILING_WORDS = ["ください", "くださる"]

const PUNCTUATION: Record<string, string> = {
  "。": ".", "、": ",", "！": "!", "？": "?", "…": "...",
  "「": '"', "」": '"', "『": "'", "』": "'",
  "（": "(", "）": ")", "・": " ", "〜": "~", "ー": "-",
}

const isKana = (c: string) => /[ぁ-んァ-ヺー]/.test(c)
const isKanji = (c: string) => /[一-龯々]/.test(c)

/** Convert a kana string, dropping anything wanakana cannot handle. */
function kanaToRomaji(kana: string): string {
  return toRomaji(kana).trim()
}

/** Convert one kana token, honouring particle pronunciation. */
function tokenToRomaji(kana: string, isStandaloneParticle: boolean): string[] {
  if (isStandaloneParticle && PARTICLE_ROMAJI[kana]) {
    return [PARTICLE_ROMAJI[kana]]
  }

  // Split a trailing auxiliary so 「曲がってください」 reads "magatte kudasai".
  for (const tail of TRAILING_WORDS) {
    if (kana.length > tail.length && kana.endsWith(tail)) {
      return [kanaToRomaji(kana.slice(0, -tail.length)), kanaToRomaji(tail)]
    }
  }
  return [kanaToRomaji(kana)]
}

/**
 * Split a hiragana run so leading particles become their own tokens.
 *
 * Deliberately conservative and non-recursive: 「です」 begins with で, which is
 * a particle, but splitting it would give "de su". A particle is only split off
 * when what follows is long enough to be a word in its own right.
 */
function splitParticles(run: string): string[] {
  if (PARTICLES.has(run)) return [run]

  for (const len of [2, 1]) {
    const head = run.slice(0, len)
    const rest = run.slice(len)
    if (PARTICLES.has(head) && rest.length >= 2) return [head, rest]
  }
  return [run]
}

/** Look up a bare kanji run, longest match first. */
function readKanjiRun(run: string): string | null {
  for (let len = run.length; len >= 1; len--) {
    const reading = COMMON_READINGS[run.slice(0, len)]
    if (reading) {
      const rest = run.slice(len)
      if (!rest) return reading
      const restReading = readKanjiRun(rest)
      return restReading === null ? null : reading + restReading
    }
  }
  return null
}

/** Break a plain-text segment into romaji tokens. */
function tokenizePlain(text: string): string[] {
  const tokens: string[] = []
  let i = 0

  while (i < text.length) {
    const c = text[i]

    if (PUNCTUATION[c] !== undefined) {
      const p = PUNCTUATION[c]
      // Attach closing punctuation to the previous token so it reads naturally.
      if (/[.,!?]/.test(p) && tokens.length) tokens[tokens.length - 1] += p
      else if (p.trim()) tokens.push(p)
      i++
      continue
    }

    if (isKana(c)) {
      let j = i
      while (j < text.length && isKana(text[j])) j++
      const run = text.slice(i, j)
      const parts = splitParticles(run)
      for (const part of parts) {
        // A part is a grammatical particle when the splitter isolated it, not
        // merely because those kana appear somewhere in a longer word.
        const standalone = parts.length > 1 || PARTICLES.has(part)
        for (const r of tokenToRomaji(part, standalone)) if (r) tokens.push(r)
      }
      i = j
      continue
    }

    if (isKanji(c)) {
      let j = i
      while (j < text.length && isKanji(text[j])) j++
      const run = text.slice(i, j)
      const reading = readKanjiRun(run)
      // Unknown kanji stay as kanji — visibly unconverted beats silently wrong.
      tokens.push(reading ? kanaToRomaji(reading) : run)
      i = j
      continue
    }

    // Latin, digits, spaces and anything else pass through.
    let j = i
    while (
      j < text.length &&
      !isKana(text[j]) &&
      !isKanji(text[j]) &&
      PUNCTUATION[text[j]] === undefined
    ) j++
    const rest = text.slice(i, j).trim()
    if (rest) tokens.push(rest)
    i = j === i ? i + 1 : j
  }

  return tokens
}

/**
 * Transliterate Japanese text to spaced romaji, using the furigana already
 * present in the text to read its kanji.
 */
export function convertToRomaji(text: string): string {
  const tokens: string[] = []
  const segments = parseJapaneseText(text)

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]

    if (seg.type === "ruby") {
      let word = seg.reading + seg.okurigana

      // 曲(ま)がって — the model annotates only the kanji, leaving the okurigana
      // in the following text. A one-kana reading is overwhelmingly a verb or
      // adjective stem, so the hiragana that follows belongs to the same word;
      // a longer reading is usually a noun, and what follows is a particle.
      const next = segments[s + 1]
      if (seg.reading.length === 1 && !seg.okurigana && next?.type === "text") {
        const oku = next.text.match(/^[ぁ-ん]+/)?.[0]
        if (oku && !PARTICLES.has(oku)) {
          word += oku
          segments[s + 1] = { type: "text", text: next.text.slice(oku.length) }
        }
      }

      for (const r of tokenToRomaji(word, false)) if (r) tokens.push(r)
      continue
    }

    if (seg.type === "katakana") {
      tokens.push(kanaToRomaji(seg.term))
      continue
    }
    tokens.push(...tokenizePlain(seg.text))
  }

  return tokens.filter(Boolean).join(" ").replace(/\s+([.,!?])/g, "$1").trim()
}
