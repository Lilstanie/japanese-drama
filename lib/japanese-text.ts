import { parseFuriganaSegments } from "@/lib/furigana"
import { parseKatakanaSegments } from "@/lib/katakana"

/**
 * One pass over Japanese text producing both annotation layers:
 * furigana readings over kanji, and source words over katakana loanwords.
 */
export type JaSegment =
  | { type: "text"; text: string }
  | { type: "ruby"; kanji: string; reading: string; okurigana: string }
  | { type: "katakana"; term: string; gloss: string | null; src?: string }

/**
 * Furigana is parsed first because its markup (`食べ物(たべもの)`) must stay
 * intact — katakana never appears inside a hiragana reading, so the two layers
 * cannot collide.
 */
export function parseJapaneseText(
  text: string,
  glosses?: Map<string, string | null>
): JaSegment[] {
  const out: JaSegment[] = []

  for (const seg of parseFuriganaSegments(text)) {
    if (seg.type === "ruby") {
      out.push(seg)
      continue
    }
    out.push(...parseKatakanaSegments(seg.text, glosses))
  }

  return out
}
