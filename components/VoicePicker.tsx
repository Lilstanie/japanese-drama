"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useVoices } from "@/components/VoiceProvider"
import { ROLES, voicesForRole, type VoiceRole } from "@/lib/voices"

/** One short line per language, so a preview says something worth hearing. */
const SAMPLE: Record<string, string> = {
  ja: "いらっしゃいませ。今日はいい天気ですね。",
  zh: "你好，今天天气不错，我们开始练习吧。",
}

/**
 * Voice picker for a single speaking role, sized to sit in a toolbar next to
 * the controls it affects.
 *
 * Preview synthesises through the normal TTS route rather than playing a
 * bundled clip, so what you hear is exactly what the app will say — including
 * the current provider and any env override.
 */
export default function VoicePicker({
  role,
  label,
}: {
  role: VoiceRole
  /** Overrides the role's default label when the surrounding UI needs shorter. */
  label?: string
}) {
  const { voiceFor, setVoice } = useVoices()
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const selected = voiceFor(role)
  const meta = ROLES[role]
  const options = voicesForRole(role)

  const cleanup = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  // Never leave a playing clip or a blob URL behind on unmount.
  useEffect(() => cleanup, [cleanup])

  const preview = useCallback(async () => {
    if (state === "playing") { cleanup(); setState("idle"); return }

    cleanup()
    setState("loading")
    try {
      const res = await fetch("/api/podcast/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: SAMPLE[meta.language],
          speaker: meta.language === "ja" ? "A" : "B",
          lang: meta.language,
          voice: selected,
        }),
      })
      if (!res.ok) throw new Error(`TTS ${res.status}`)

      const url = URL.createObjectURL(await res.blob())
      urlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { cleanup(); setState("idle") }
      audio.onerror = () => { cleanup(); setState("idle") }
      await audio.play()
      setState("playing")
    } catch {
      // A failed preview stays quiet rather than blocking the picker.
      cleanup()
      setState("idle")
    }
  }, [state, cleanup, meta.language, selected])

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap" style={{ color: "#7a5c38" }}>
        {label ?? meta.label}
      </span>

      <select
        value={selected}
        onChange={(e) => { cleanup(); setState("idle"); setVoice(role, e.target.value) }}
        className="text-xs rounded-lg px-2 py-1 outline-none cursor-pointer"
        style={{
          background: "#2d1508",
          color: "#f0d5a0",
          border: "1px solid #5c3010",
          maxWidth: "170px",
        }}
      >
        {options.map((v) => (
          <option key={v.name} value={v.name}>
            {v.gender === "female" ? "♀" : "♂"} {v.cambName} — {v.description}
          </option>
        ))}
      </select>

      <button
        onClick={preview}
        disabled={state === "loading"}
        title="试听"
        aria-label={`试听${label ?? meta.label}`}
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all disabled:cursor-wait"
        style={{
          fontSize: "10px",
          background: state === "playing" ? "#f59e0b" : "transparent",
          color: state === "playing" ? "#1a0c02" : "#f59e0b",
          border: `1px solid ${state === "playing" ? "#f59e0b" : "#5c3010"}`,
        }}
      >
        {state === "loading" ? "…" : state === "playing" ? "■" : "▶"}
      </button>
    </div>
  )
}
