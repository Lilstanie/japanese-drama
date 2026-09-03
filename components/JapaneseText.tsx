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
          // <rt> is emitted BEFORE the base on purpose. The ruby box is laid out
          // as an inline-block whose two lines are centred on each other (see
          // .ruby-text ruby in globals.css); in that model the reading has to
          // come first in the DOM to sit on top. Native ruby-align could not be
          // relied on — it left readings visibly off-centre.
          return (
            <span key={i}>
              <ruby>
                <rt style={rtColor ? { color: rtColor } : undefined}>
                  {seg.reading}
                </rt>
                <span className="rb">{seg.kanji}</span>
              </ruby>
              {seg.okurigana}
            </span>
          )
        }

        if (!showKatakanaEn) return <span key={i}>{seg.term}</span>

        if (!seg.gloss) {
          // Checked and confirmed not a loanword — mark it, so "no English
          // here" reads as an answer rather than as the feature failing.
          // A pending lookup stays bare until its answer arrives.
          if (seg.status !== "checked") return <span key={i}>{seg.term}</span>
          return (
            <span
              key={i}
              className="kt-plain"
              title={`${seg.term} — 非外来语（不是借词）`}
            >
              {seg.term}
            </span>
          )
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
