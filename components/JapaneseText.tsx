"use client"

import { useEffect, useMemo } from "react"
import { parseJapaneseText } from "@/lib/japanese-text"
import { useAnnotations } from "@/components/AnnotationProvider"

const LANGUAGE_NAMES: Record<string, string> = {
  de: "German",
  fr: "French",
  pt: "Portuguese",
  nl: "Dutch",
  it: "Italian",
  es: "Spanish",
  ru: "Russian",
  zh: "Chinese",
}

/**
 * Renders Japanese text with two annotation layers:
 *
 *   - furigana readings over kanji, via native <ruby>
 *   - source words above katakana loanwords, via a width-reserving inline-block
 *
 * Katakana glosses deliberately do NOT use <ruby>. An English source word is
 * usually far wider than the katakana beneath it ("convenience store" over
 * コンビニ), and ruby text overflows its base without reserving layout width, so
 * it collides with neighbouring words. The inline-block box below sizes itself
 * to whichever of the two lines is wider and centres both, which keeps the
 * katakana on the surrounding text's baseline while making overlap impossible.
 *
 * Pass `isStreaming` for text that is still arriving: partial katakana runs
 * would otherwise be sent to the gloss API as if they were whole words.
 */
export default function JapaneseText({
  text,
  rtColor,
  isStreaming = false,
}: {
  text: string
  rtColor?: string
  isStreaming?: boolean
}) {
  const { showKatakanaEn, glosses, requestGlosses } = useAnnotations()

  useEffect(() => {
    if (isStreaming) return
    requestGlosses(text)
  }, [text, isStreaming, requestGlosses])

  const segments = useMemo(
    () => parseJapaneseText(text, glosses),
    [text, glosses]
  )

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.text}</span>

        if (seg.type === "ruby") {
          return (
            <span key={i}>
              <ruby>
                {seg.kanji}
                <rt style={rtColor ? { color: rtColor } : undefined}>
                  {seg.reading}
                </rt>
              </ruby>
              {seg.okurigana}
            </span>
          )
        }

        if (!seg.gloss || !showKatakanaEn) {
          return <span key={i}>{seg.term}</span>
        }

        const origin = seg.src ? LANGUAGE_NAMES[seg.src] ?? seg.src : "English"

        return (
          <span key={i} className="kt" title={`${seg.term} — ${origin}: ${seg.gloss}`}>
            <span className="kt-en">{seg.gloss}</span>
            <span className="kt-ja">
              <span className="kt-mark">{seg.term}</span>
            </span>
          </span>
        )
      })}
    </>
  )
}
