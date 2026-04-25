"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Message } from "@/lib/types"
import { convertToRomaji } from "@/lib/romaji"

function stripFurigana(text: string): string {
  return text.replace(/\(([ぁ-んァ-ン]+)\)/g, "")
}

function renderFurigana(text: string) {
  const parts = text.split(/(\S+\([ぁ-ん]+\))/g)
  return parts.map((part, i) => {
    const match = part.match(/^(.+)\(([ぁ-ん]+)\)$/)
    if (match) {
      return (
        <ruby key={i}>
          {match[1]}
          <rt style={{ fontSize: "0.65em", color: "#f59e0b" }}>{match[2]}</rt>
        </ruby>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function isFemaleVoice(name: string) {
  return /kyoko|o-ren|haruka|nanami|keiko|mizuki|sakura|hana|yui|female|woman/i.test(name)
}

function pickVoice(voices: SpeechSynthesisVoice[], preferFemale: boolean) {
  const ja = voices.filter(v => v.lang.startsWith("ja"))
  if (!ja.length) return null
  if (preferFemale) {
    return (
      ja.find(v => isFemaleVoice(v.name) && /enhanced|premium/i.test(v.name)) ??
      ja.find(v => isFemaleVoice(v.name)) ??
      ja[0]
    )
  } else {
    const male = ja.filter(v => !isFemaleVoice(v.name))
    return (
      male.find(v => /enhanced|premium/i.test(v.name)) ??
      male[0] ??
      ja[0]
    )
  }
}

function speak(text: string, voiceName: string, onEnd: () => void) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(stripFurigana(text))
  utterance.lang = "ja-JP"
  utterance.rate = 0.85
  const voice = window.speechSynthesis.getVoices().find(v => v.name === voiceName)
  if (voice) utterance.voice = voice
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

function VoiceSelect({
  label,
  voices,
  value,
  onChange,
}: {
  label: string
  voices: SpeechSynthesisVoice[]
  value: string
  onChange: (name: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap" style={{ color: "#7a5c38" }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
        style={{ background: "#2d1508", color: "#f0d5a0", border: "1px solid #5c3010", maxWidth: "140px" }}
      >
        {voices.map(v => (
          <option key={v.name} value={v.name}>
            {isFemaleVoice(v.name) ? "♀ " : "♂ "}{v.name.replace(/\s*\(.*?\)/g, "")}
          </option>
        ))}
      </select>
    </div>
  )
}

function SpeakButton({
  id, text, playingId, onPlay, onStop,
}: {
  id: string; text: string; playingId: string | null
  onPlay: (id: string, text: string) => void; onStop: () => void
}) {
  const isPlaying = playingId === id
  return (
    <button
      onClick={() => isPlaying ? onStop() : onPlay(id, text)}
      className="mt-2 flex items-center gap-1 text-xs rounded-lg px-2 py-1 transition-all"
      style={{
        background: isPlaying ? "#f59e0b22" : "transparent",
        color: isPlaying ? "#f59e0b" : "#5c3d1e",
        border: `1px solid ${isPlaying ? "#f59e0b55" : "#3d2010"}`,
      }}
    >
      {isPlaying ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#f59e0b" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#f59e0b" }} />
          </span>
          停止
        </>
      ) : <>🔊</>}
    </button>
  )
}

function Bubble({
  msg, characterName, showRomaji, playingId, onPlay, onStop,
}: {
  msg: Message; characterName: string; showRomaji: boolean
  playingId: string | null
  onPlay: (id: string, text: string) => void; onStop: () => void
}) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
        style={isUser
          ? { background: "#7c4b14", color: "#fde8c0", borderBottomRightRadius: "4px" }
          : { background: "#2d1508", color: "#f0d5a0", border: "1px solid #5c3010", borderBottomLeftRadius: "4px" }
        }
      >
        {!isUser && (
          <div className="text-xs mb-1 font-semibold" style={{ color: "#f59e0b" }}>
            {characterName}
          </div>
        )}
        <div>{renderFurigana(msg.content)}</div>
        {showRomaji && (
          <div className="mt-1.5 text-xs italic leading-snug border-t pt-1"
            style={{ color: isUser ? "#f0c080" : "#a07850", borderColor: isUser ? "#9c6b24" : "#3d2010" }}>
            {convertToRomaji(msg.content)}
          </div>
        )}
        <SpeakButton id={msg.id} text={msg.content} playingId={playingId} onPlay={onPlay} onStop={onStop} />
      </div>
    </div>
  )
}

export default function DialogPanel({
  messages, characterName, isStreaming, streamingText, showRomaji,
}: {
  messages: Message[]; characterName: string
  isStreaming: boolean; streamingText: string; showRomaji: boolean
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [jaVoices, setJaVoices] = useState<SpeechSynthesisVoice[]>([])
  const [charVoice, setCharVoice] = useState("")
  const [userVoice, setUserVoice] = useState("")

  useEffect(() => {
    function load() {
      const all = window.speechSynthesis.getVoices()
      const ja = all.filter(v => v.lang.startsWith("ja"))
      if (!ja.length) return
      setJaVoices(ja)
      // only set defaults once
      setCharVoice(prev => prev || (pickVoice(ja, true)?.name ?? ja[0].name))
      setUserVoice(prev => prev || (pickVoice(ja, false)?.name ?? ja[0].name))
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  const handlePlay = useCallback((id: string, text: string) => {
    // find the message to know if it's user or character
    const msg = messages.find(m => m.id === id)
    const voiceName = msg?.role === "user" ? userVoice : charVoice
    speak(text, voiceName, () => setPlayingId(null))
    setPlayingId(id)
  }, [messages, charVoice, userVoice])

  const handleStop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setPlayingId(null)
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: "#1e0e04" }}>

      {/* Header row 1: title */}
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-2"
        style={{ background: "#1a0c02" }}>
        <span className="text-lg">🇯🇵</span>
        <span className="font-bold text-sm" style={{ color: "#f59e0b", fontFamily: "serif" }}>
          {characterName}
        </span>
        <span className="text-xs" style={{ color: "#7a5c38" }}>との会話</span>
      </div>

      {/* Header row 2: voice selectors */}
      {jaVoices.length > 0 && (
        <div className="px-4 pb-2 border-b flex flex-wrap gap-x-3 gap-y-1"
          style={{ borderColor: "#3d2010", background: "#1a0c02" }}>
          <VoiceSelect
            label="角色声音"
            voices={jaVoices}
            value={charVoice}
            onChange={v => { setCharVoice(v); window.speechSynthesis?.cancel(); setPlayingId(null) }}
          />
          <VoiceSelect
            label="我的声音"
            voices={jaVoices}
            value={userVoice}
            onChange={v => { setUserVoice(v); window.speechSynthesis?.cancel(); setPlayingId(null) }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <Bubble key={msg.id} msg={msg} characterName={characterName}
            showRomaji={showRomaji} playingId={playingId}
            onPlay={handlePlay} onStop={handleStop} />
        ))}

        {isStreaming && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              style={{ background: "#2d1508", color: "#f0d5a0", border: "1px solid #5c3010", borderBottomLeftRadius: "4px" }}>
              <div className="text-xs mb-1 font-semibold" style={{ color: "#f59e0b" }}>{characterName}</div>
              <div>{renderFurigana(streamingText)}</div>
              {showRomaji && (
                <div className="mt-1.5 text-xs italic leading-snug border-t pt-1"
                  style={{ color: "#a07850", borderColor: "#3d2010" }}>
                  {convertToRomaji(streamingText)}
                </div>
              )}
              <span className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse rounded-sm"
                style={{ background: "#f59e0b", verticalAlign: "text-bottom" }} />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 text-sm"
              style={{ background: "#2d1508", border: "1px solid #5c3010" }}>
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: "#f59e0b", animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
