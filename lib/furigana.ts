export type FuriganaSegment =
  | { type: "text"; text: string }
  | { type: "ruby"; kanji: string; reading: string; okurigana: string }

function splitOkurigana(
  base: string,
  reading: string
): { kanji: string; reading: string; okurigana: string } {
  let okuLen = 0
  for (let i = base.length - 1; i >= 0; i--) {
    if (/[ぁ-ん]/.test(base[i])) okuLen++
    else break
  }
  if (okuLen > 0) {
    const okurigana = base.slice(-okuLen)
    if (reading.endsWith(okurigana)) {
      return { kanji: base.slice(0, -okuLen), reading: reading.slice(0, -okuLen), okurigana }
    }
  }
  return { kanji: base, reading, okurigana: "" }
}

export function parseFuriganaSegments(text: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = []
  // Base must start with a kanji so preceding hiragana (e.g. ちょっと in ちょっと難(むずか)) are not captured
  const re = /([一-龯々][一-龯々ぁ-ん]*)\(([ぁ-ん]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) })
    }
    const split = splitOkurigana(match[1], match[2])
    segments.push({ type: "ruby", ...split })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) })
  }

  return segments
}

export function parseRuby(text: string): string {
  return text.replace(/([一-龯々][一-龯々ぁ-ん]*)\(([ぁ-ん]+)\)/g, "<ruby>$1<rt>$2</rt></ruby>")
}
