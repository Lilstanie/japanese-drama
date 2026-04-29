import { parseFuriganaSegments } from "@/lib/furigana"

export default function FuriganaText({
  text,
  rtColor,
}: {
  text: string
  rtColor?: string
}) {
  return (
    <>
      {parseFuriganaSegments(text).map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.text}</span>
        return (
          <span key={i}>
            <ruby>
              {seg.kanji}
              <rt style={rtColor ? { color: rtColor } : undefined}>{seg.reading}</rt>
            </ruby>
            {seg.okurigana}
          </span>
        )
      })}
    </>
  )
}
