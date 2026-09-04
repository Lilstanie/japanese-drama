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
 * Word segmentation lexicon.
 *
 * Japanese is written without spaces, so producing readable romaji means
 * deciding where words end. Two shortcuts make that tractable here rather than
 * needing a morphological analyser:
 *
 *   - Kanji word boundaries come free from the furigana markup, since the model
 *     annotates whole words: 食べ物(たべもの) is one unit by construction.
 *   - Katakana runs are already segmented by the loanword dictionary.
 *
 * That leaves only hiragana runs, which this lexicon splits. A run is scanned
 * left to right, matching KANA_WORDS *before* PARTICLES at each position — で is
 * a particle, but できる is a word, and the longer word has to win.
 *
 * Anything unmatched is emitted as one chunk rather than guessed at, so an
 * unknown word stays joined instead of being shredded into syllables.
 *
 * (Evaluated TinySegmenter for this and rejected it: it split ください into
 * く+ださい and すみません into すみませ+ん.)
 */
const KANA_WORDS = new Set([
  // Copula and polite auxiliaries — conventionally their own word in romaji
  "です", "でした", "ではない", "じゃない", "ください", "ませんか",
  "ましょう", "でしょう", "だろう", "ある", "あります", "ありました",
  "ありません", "いる", "います", "いました", "いません",
  // Very common kana verbs
  "する", "します", "しました", "しません", "して", "した",
  "できる", "できます", "できません", "できた",
  "なる", "なります", "なりました", "いく", "いきます", "くる", "きます",
  "みる", "みます", "いう", "いいます", "おもう", "おもいます",
  "わかる", "わかります", "わかりました", "しる", "しっています",
  "もらう", "もらいます", "あげる", "あげます", "くれる", "くれます",
  "つかう", "つかいます", "まつ", "まちます", "のむ", "のみます",
  "たべる", "たべます", "かう", "かいます", "いれる", "いれます",
  // Adjectives and adverbs
  "いい", "よい", "よく", "わるい", "おおきい", "ちいさい", "たかい",
  "やすい", "あたらしい", "ふるい", "はやい", "おそい", "おいしい",
  "たのしい", "うれしい", "むずかしい", "やさしい", "ちかい", "とおい",
  "とても", "ちょっと", "すこし", "たくさん", "もう", "まだ", "すぐ",
  "ゆっくり", "いつも", "ときどき", "たいてい", "ぜんぶ", "みんな",
  "いちばん", "もっと", "あまり", "ぜんぜん", "だいたい", "きっと",
  // Pronouns, demonstratives, formal nouns
  "これ", "それ", "あれ", "どれ", "この", "その", "あの", "どの",
  "ここ", "そこ", "あそこ", "どこ", "こんな", "そんな", "あんな", "どんな",
  "こちら", "そちら", "あちら", "どちら", "わたし", "あなた",
  "こと", "もの", "とき", "ところ", "ひと", "かた", "ため", "つもり",
  // Greetings and set phrases
  "はい", "いいえ", "すみません", "ありがとう", "ございます",
  "おねがい", "おねがいします", "いらっしゃいませ", "ようこそ",
  "こんにちは", "こんばんは", "おはよう", "さようなら", "しつれいします",
  "だいじょうぶ", "もちろん", "ほんとう", "たぶん", "やっぱり",
  // Connectives
  "そして", "でも", "だから", "しかし", "それから", "それで", "また",
  "じゃあ", "では", "ですが", "ですから", "なので",
])

/**
 * Grammatical particles. Split off the word they follow, and — for は, へ and
 * を — pronounced differently from how they are spelled.
 */
const PARTICLES = new Set([
  "は", "が", "を", "に", "へ", "で", "と", "も", "の", "や",
  "から", "まで", "より", "など", "けど", "ので", "のに",
  "ばかり", "だけ", "しか", "ぐらい", "くらい", "ずつ", "とか", "には",
  "では", "とは", "にも", "でも",
])

/**
 * Sentence-final particles, matched only at the end of a run. か is a particle
 * in 「しませんか」 but the first syllable of a word in 「かけて」, and only
 * position tells them apart.
 */
const FINAL_PARTICLES = new Set(["か", "ね", "よ", "な", "わ", "かな", "よね"])

/**
 * Particles that beat a longer word when they directly follow a content word.
 *
 * Only one-sided ambiguities belong here. 今日はいい must read 今日 + は + いい
 * rather than 今日 + はい + い, and はい almost never follows a noun. で is
 * excluded on purpose: です and できる follow content words constantly, so
 * preferring the particle there would produce "de su" and "de kiru".
 */
const LEADING_PARTICLES = new Set(["は", "が", "を", "に", "へ"])

/**
 * Particles that always end a word, used when absorbing okurigana after a
 * one-kana stem. が is absent on purpose: it is the okurigana of 曲がる far more
 * often than it is the subject particle in that position.
 */
const HARD_BOUNDARY = new Set(["は", "を", "の", "へ", "も", "と", "か", "ね", "よ"])

/** No Japanese inflection runs longer than this; a cap stops runaway merging. */
const MAX_OKURIGANA = 6

/**
 * Auxiliaries that end a verb's okurigana and start their own word.
 *
 * Distinguished from inflections that merely look like words: ください in
 * 曲がってください is a separate word, but いました in 会いました is the verb's
 * own past tense, not the verb いる.
 */
const OKURIGANA_STOP = ["ください", "くださる", "です", "でした", "ですか"]

/**
 * Honorific prefixes attach to the word *after* them (お手伝い → otetsudai),
 * unlike everything else here.
 */
const PREFIXES = new Set(["お", "ご"])

/**
 * Kana that commonly serve as okurigana. Used to decide whether hiragana right
 * after a kanji belongs to that word (探し → sagashi) or is a particle
 * starting a new one (足に → ashi ni). Particles are excluded on purpose.
 */
const OKURIGANA = new Set([
  "い", "う", "え", "き", "く", "け", "こ", "し", "す", "せ", "そ",
  "ち", "つ", "っ", "て", "と", "ば", "び", "べ", "ま", "み", "む",
  "め", "り", "る", "れ", "ろ", "げ", "ぎ", "ぐ", "ら", "た", "じ", "ず",
])

/**
 * Particles whose pronunciation differs from their spelling. は is read "wa"
 * and へ "e" only as particles — inside a word (はい, へや) they keep their
 * normal sound, so this applies to particle tokens, not by string replacement.
 */
const PARTICLE_ROMAJI: Record<string, string> = {
  "は": "wa",
  "へ": "e",
  "を": "o",
}

/** Auxiliaries conventionally written as their own word in romaji. */
const TRAILING_WORDS = ["ください", "ください。"]

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

/** Longest lexicon or particle match starting at `i`, or null. */
function matchAt(run: string, i: number): { word: string; particle: boolean } | null {
  // Words are tried before particles at every position: で is a particle but
  // できる is a word, and matching the particle first would shred the verb.
  for (let len = Math.min(8, run.length - i); len >= 1; len--) {
    const candidate = run.slice(i, i + len)
    if (KANA_WORDS.has(candidate)) return { word: candidate, particle: false }
  }
  for (let len = Math.min(4, run.length - i); len >= 1; len--) {
    const candidate = run.slice(i, i + len)
    if (PARTICLES.has(candidate)) return { word: candidate, particle: true }
    if (FINAL_PARTICLES.has(candidate) && i + len === run.length) {
      return { word: candidate, particle: true }
    }
  }
  return null
}

type KanaToken = { kana: string; particle: boolean; prefix?: boolean }

/**
 * Split a hiragana run into words.
 *
 * `okuriganaLimit` is how many leading characters may still belong to the
 * preceding word — see attachableOkurigana().
 */
function segmentKana(
  run: string,
  okuriganaLimit: number,
  followsContent = false
): KanaToken[] {
  const tokens: KanaToken[] = []
  let i = okuriganaLimit

  while (i < run.length) {
    // Right after a content word a leading particle wins over any longer word
    // that happens to start with it: 今日はいい is 今日 + は + いい, not
    // 今日 + はい + い. Standalone はい is unaffected, having no word before it.
    let m = matchAt(run, i)
    if (i === okuriganaLimit && followsContent) {
      const head = run[i]
      if (LEADING_PARTICLES.has(head)) m = { word: head, particle: true }
    }

    if (m) {
      if (PREFIXES.has(m.word) && !m.particle) {
        // お / ご belong to what follows, not what precedes.
        tokens.push({ kana: m.word, particle: false, prefix: true })
      } else {
        tokens.push({ kana: m.word, particle: m.particle })
      }
      i += m.word.length
      continue
    }

    if (PREFIXES.has(run[i])) {
      tokens.push({ kana: run[i], particle: false, prefix: true })
      i++
      continue
    }

    // Unknown: keep going until a known word starts, so an unfamiliar word
    // stays in one piece instead of being split into syllables.
    let j = i + 1
    while (j < run.length && !matchAt(run, j) && !PREFIXES.has(run[j])) j++
    tokens.push({ kana: run.slice(i, j), particle: false })
    i = j
  }

  // Fold each honorific prefix into the token after it.
  const merged: KanaToken[] = []
  for (const t of tokens) {
    const prev = merged[merged.length - 1]
    if (prev?.prefix) {
      merged[merged.length - 1] = { kana: prev.kana + t.kana, particle: false }
    } else {
      merged.push(t)
    }
  }
  return merged
}

/**
 * How many leading characters of `run` are okurigana belonging to the kanji
 * word before it.
 *
 * 足(あし)に and 探(さが)し look identical in shape — kanji, then hiragana — so
 * this leans on two signals. A one-kana reading is almost always a verb or
 * adjective stem, whose okurigana runs until the next real word (曲(ま)がって).
 * Otherwise only kana that actually serve as okurigana are absorbed, which
 * takes し in 探し while leaving に in 足に as the particle it is.
 */
function attachableOkurigana(run: string, reading: string): number {
  if (!run) return 0

  if (reading.length <= 1) {
    // A one-kana reading is a verb or adjective stem, so what follows is its
    // inflection — even when those kana happen to spell a word on their own
    // (会(あ)いました: いました is also a form of いる, but here it is okurigana).
    // Only an unambiguous particle ends the word.
    let j = 0
    while (j < run.length && j < MAX_OKURIGANA && !HARD_BOUNDARY.has(run[j])) {
      if (j > 0 && OKURIGANA_STOP.some((w) => run.startsWith(w, j))) break
      j++
    }
    return j
  }

  let j = 0
  while (j < run.length && OKURIGANA.has(run[j]) && !matchAt(run, j)) j++
  return j
}

/** Look up a bare kanji run/** Look up a bare kanji run, longest match first. */
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

/**
 * Break a plain-text segment into tokens.
 *
 * Returns the trailing honorific prefix separately when the segment ends in
 * one: お in 「何をお探し」 belongs to the kanji word in the *next* segment.
 */
function tokenizePlain(
  text: string,
  followsContent: boolean
): { tokens: string[]; trailingPrefix: string } {
  const tokens: string[] = []
  let trailingPrefix = ""
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
      // Only the very first run of the segment sits right after the previous word.
      const kanaTokens = segmentKana(
        text.slice(i, j), 0, followsContent && tokens.length === 0
      )
      kanaTokens.forEach((t, idx) => {
        const isLast = idx === kanaTokens.length - 1 && j === text.length
        if (isLast && t.prefix) { trailingPrefix = t.kana; return }
        for (const r of tokenToRomaji(t.kana, t.particle)) if (r) tokens.push(r)
      })
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

  return { tokens, trailingPrefix }
}

/**
 * Transliterate Japanese text to spaced romaji, using the furigana already
 * present in the text to read its kanji.
 */
export function convertToRomaji(text: string): string {
  const tokens: string[] = []
  const segments = parseJapaneseText(text)

  // Holds kana that must join the *next* word: an honorific prefix, or the
  // first half of a word the model annotated in two pieces (食(た)べ物(もの)).
  let carry = ""
  let prevWasContent = false

  const emit = (word: string, particle = false) => {
    for (const r of tokenToRomaji(word, particle)) if (r) tokens.push(r)
  }

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s]

    if (seg.type === "ruby") {
      let word = carry + seg.reading + seg.okurigana
      carry = ""

      const next = segments[s + 1]
      if (!seg.okurigana && next?.type === "text") {
        const run = next.text.match(/^[ぁ-ん]+/)?.[0] ?? ""
        const take = attachableOkurigana(run, seg.reading)
        if (take > 0) {
          word += run.slice(0, take)
          segments[s + 1] = { type: "text", text: next.text.slice(take) }
        }
      }

      // 食(た)べ物(もの) is one word the model annotated twice. If nothing is
      // left between this ruby and the next, they belong together.
      const after = segments[s + 1]
      const joinsNextRuby =
        after?.type === "ruby" ||
        (after?.type === "text" && after.text === "" && segments[s + 2]?.type === "ruby")
      if (joinsNextRuby) {
        carry = word
      } else {
        emit(word)
      }

      prevWasContent = true
      continue
    }

    if (seg.type === "katakana") {
      emit(carry + seg.term)
      carry = ""
      prevWasContent = true
      continue
    }

    if (!seg.text) continue

    const { tokens: plain, trailingPrefix } = tokenizePlain(seg.text, prevWasContent)
    if (carry && plain.length === 0 && !trailingPrefix) {
      // Nothing here to attach to; do not lose the carried kana.
      emit(carry)
      carry = ""
    } else if (carry) {
      emit(carry)
      carry = ""
    }
    tokens.push(...plain)
    carry = trailingPrefix
    prevWasContent = plain.length > 0 && !trailingPrefix
  }

  if (carry) emit(carry)

  return tokens.filter(Boolean).join(" ").replace(/\s+([.,!?])/g, "$1").trim()
}
