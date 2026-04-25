import { toRomaji } from "wanakana"

export function convertToRomaji(text: string): string {
  // Strip furigana markers: 食べ物(たべもの) → たべもの
  const kanaOnly = text.replace(/[^ぁ-んァ-ン\s(（]+\(([ぁ-んァ-ン]+)\)/g, "$1")
  // Remove punctuation that wanakana can't handle
  const cleaned = kanaOnly.replace(/[！？。、…「」『』【】（）]/g, (c) => {
    const map: Record<string, string> = {
      "！": "! ", "？": "? ", "。": ". ", "、": ", ",
      "…": "...", "「": '"', "」": '"', "『": "'", "』": "'",
    }
    return map[c] ?? " "
  })
  return toRomaji(cleaned).trim()
}
