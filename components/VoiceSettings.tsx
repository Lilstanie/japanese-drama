"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useVoices } from "@/components/VoiceProvider"
import { ROLES, voiceByName, voicesForRole, type VoiceRole } from "@/lib/voices"

/** One short line per language, so a preview says something worth hearing. */
const SAMPLE: Record<string, string> = {
  ja: "いらっしゃいませ。今日はいい天気ですね。",
  zh: "你好，今天天气不错，我们开始练习吧。",
}

const ROLE_ORDER: VoiceRole[] = ["character", "narrator", "chinese"]

function RoleRow({ role }: { role: VoiceRole }) {
  const { voiceFor, setVoice } = useVoices()
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const selected = voiceFor(role)
  const options = voicesForRole(role)
  const meta = ROLES[role]

  const cleanup = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  // Never leave a fetch or a blob URL behind on unmount.
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
      // A failed preview should say nothing rather than block the picker.
      cleanup()
      setState("idle")
    }
  }, [state, cleanup, meta.language, selected])

  const current = voiceByName(selected)

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-xs" style={{ color: "#7a5c38" }}>
          {meta.label}
          <span className="hidden sm:inline"> · {meta.hint}</span>
        </span>
        <select
          value={selected}
          onChange={(e) => { cleanup(); setState("idle"); setVoice(role, e.target.value) }}
          className="text-sm rounded-lg px-2.5 py-1.5 outline-none cursor-pointer w-full"
          style={{ background: "#2d1508", color: "#f0d5a0", border: "1px solid #5c3010" }}
        >
          {options.map((v) => (
            <option key={v.name} value={v.name}>
              {v.gender === "female" ? "♀" : "♂"} {v.cambName} — {v.description}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={preview}
        disabled={state === "loading"}
        title={`试听 ${current?.cambName ?? ""}`}
        aria-label={`试听 ${current?.cambName ?? ""}`}
        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all mt-4 disabled:cursor-wait"
        style={{
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

/**
 * Voice picker for the three speaking roles.
 *
 * Preview synthesises through the normal TTS route rather than shipping audio
 * files, so what you hear is exactly what the app will say.
 */
export default function VoiceSettings() {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="self-center text-xs px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: open ? "#2d1508" : "transparent",
          color: "#a07850",
          border: "1px solid #3d2010",
        }}
        aria-expanded={open}
      >
        🎙 声音设置 {open ? "▲" : "▼"}
      </button>

      {open ? (
        <div
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{ background: "#1e0e04", border: "1px solid #3d2010" }}
        >
          {ROLE_ORDER.map((role) => (
            <RoleRow key={role} role={role} />
          ))}
          <p className="text-xs leading-relaxed" style={{ color: "#5c3d1e" }}>
            选择会记住，场景对话和播客都会用。首次试听可能要等几秒。
          </p>
        </div>
      ) : null}
    </div>
  )
}
