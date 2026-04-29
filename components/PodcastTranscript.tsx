"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { parseRuby } from "@/lib/furigana"
import type { PodcastLine } from "./PodcastPlayer"

interface Props {
  transcript: PodcastLine[]
  isGenerating: boolean
  currentSpeaker: "A" | "B"
}

export default function PodcastTranscript({ transcript, isGenerating, currentSpeaker }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(true) // true = auto-scroll to bottom

  // Scroll to bottom whenever new content arrives, but only if pinned
  useEffect(() => {
    if (pinned) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript.length, isGenerating, pinned])

  // Detect manual scroll: if user scrolls up, unpin; if back near bottom, repin
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setPinned(nearBottom)
  }, [])

  function jumpToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setPinned(true)
  }

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3"
      >
        {transcript.length === 0 && !isGenerating && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "#5c3d1e" }}>
              ▶ を押して会話を始める · Press ▶ to start
            </p>
          </div>
        )}

        {transcript.map((line) => (
          <div
            key={line.id}
            className="flex gap-3 items-start"
            style={{ flexDirection: line.speaker === "A" ? "row" : "row-reverse" }}
          >
            <div className="text-lg flex-shrink-0 mt-0.5">
              {line.speaker === "A" ? "🇯🇵" : "🇨🇳"}
            </div>
            <div
              className="rounded-2xl px-4 py-2.5 max-w-[78%] text-sm transition-all"
              style={
                line.speaker === "A"
                  ? {
                      background: line.isPlaying ? "#3d1a0a" : "#261508",
                      color: line.isPlaying ? "#fde8c0" : "#d4a96a",
                      borderLeft: line.isPlaying ? "3px solid #f59e0b" : "3px solid transparent",
                      lineHeight: "2.4",
                    }
                  : {
                      background: line.isPlaying ? "#0a2a2a" : "#0d1f1f",
                      color: line.isPlaying ? "#ccfbf1" : "#5eead4",
                      borderRight: line.isPlaying ? "3px solid #14b8a6" : "3px solid transparent",
                      lineHeight: "1.6",
                    }
              }
            >
              {line.speaker === "A" ? (
                <span dangerouslySetInnerHTML={{ __html: parseRuby(line.content) }} />
              ) : (
                <span>{line.content}</span>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div
            className="flex gap-3 items-start"
            style={{ flexDirection: currentSpeaker === "A" ? "row" : "row-reverse" }}
          >
            <div className="text-lg flex-shrink-0 mt-0.5">
              {currentSpeaker === "A" ? "🇯🇵" : "🇨🇳"}
            </div>
            <div
              className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
              style={{ background: currentSpeaker === "A" ? "#261508" : "#0d1f1f" }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{
                    background: currentSpeaker === "A" ? "#f59e0b" : "#14b8a6",
                    animationDelay: `${i * 150}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Jump-to-bottom button — shown when user has scrolled up */}
      {!pinned && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-base shadow-lg transition-all hover:scale-110"
          style={{ background: "#f59e0b", color: "#1a0800" }}
          aria-label="Jump to latest"
        >
          ↓
        </button>
      )}

      <style>{`
        ruby { ruby-align: center; }
        ruby rt { font-size: 0.55em; color: #f59e0b; line-height: 1; }
      `}</style>
    </div>
  )
}
