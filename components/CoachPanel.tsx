"use client"

import { useEffect, useRef } from "react"
import type { Message } from "@/lib/types"
import FuriganaText from "@/components/FuriganaText"

export default function CoachPanel({
  messages,
  isStreaming,
  streamingText,
}: {
  messages: Message[]
  isStreaming: boolean
  streamingText: string
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  return (
    <div className="flex flex-col h-full" style={{ background: "#0e1520" }}>
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: "#1e3050", background: "#0a1018" }}
      >
        <span className="text-lg">🧑‍🏫</span>
        <span className="font-bold text-sm" style={{ color: "#60a5fa", fontFamily: "serif" }}>
          中文教练
        </span>
        <span className="text-xs ml-1" style={{ color: "#374d6a" }}>
          实时翻译 + 解析
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ruby-text"
            style={{
              background: "#111d2e",
              color: "#c8dcf0",
              border: "1px solid #1e3050",
            }}
          >
            <FuriganaText text={msg.content} rtColor="#60a5fa" />
          </div>
        ))}

        {isStreaming && streamingText && (
          <div
            className="rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ruby-text"
            style={{
              background: "#111d2e",
              color: "#c8dcf0",
              border: "1px solid #1e3050",
            }}
          >
            <FuriganaText text={streamingText} rtColor="#60a5fa" />
            <span
              className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse rounded-sm"
              style={{ background: "#60a5fa", verticalAlign: "text-bottom" }}
            />
          </div>
        )}

        {isStreaming && !streamingText && (
          <div
            className="rounded-xl px-4 py-2.5"
            style={{ background: "#111d2e", border: "1px solid #1e3050" }}
          >
            <div className="flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{
                    background: "#60a5fa",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !isStreaming && (
          <div className="text-center mt-8" style={{ color: "#2a4060" }}>
            <div className="text-3xl mb-3">💬</div>
            <p className="text-sm">教练会在角色说话后自动出现</p>
            <p className="text-xs mt-2">用 @教练 开头可以直接提问</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
