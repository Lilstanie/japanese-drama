"use client"

import type { TTSMode } from "@/lib/tts"

const SPEEDS = [0.75, 1, 1.25, 1.5] as const

interface Props {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onSkip: () => void
  speed: number
  onSpeedChange: (s: number) => void
  volume: number
  onVolumeChange: (v: number) => void
  ttsMode: TTSMode
  onTTSModeChange: (m: TTSMode) => void
  aiWorking: boolean | null // null = untested, true = working, false = fell back
}

export default function PodcastControls({
  isPlaying,
  onPlay,
  onPause,
  onSkip,
  speed,
  onSpeedChange,
  volume,
  onVolumeChange,
  ttsMode,
  onTTSModeChange,
  aiWorking,
}: Props) {
  const aiStatusDot =
    ttsMode === "ai" && aiWorking === false
      ? { color: "#ef4444", title: "AI voice failed — check your ElevenLabs key in .env.local (using robotic fallback)" }
      : ttsMode === "ai" && aiWorking === true
      ? { color: "#4ade80", title: "AI voice (ElevenLabs) is working" }
      : null

  return (
    <div
      className="border-t px-4 py-3 flex flex-wrap items-center gap-4"
      style={{ borderColor: "#3d2010", background: "#1e0e04" }}
    >
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all hover:scale-105 active:scale-95"
        style={{ background: "#f59e0b", color: "#1a0800" }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Skip */}
      <button
        onClick={onSkip}
        disabled={!isPlaying}
        className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: "#3d2010", color: "#f0d5a0" }}
        aria-label="Skip"
      >
        ⏭
      </button>

      {/* Volume */}
      <div className="flex items-center gap-2 flex-1 min-w-[100px]">
        <span className="text-base">🔊</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 accent-amber-500 h-1.5 rounded-full cursor-pointer"
          aria-label="Volume"
        />
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className="text-xs px-2 py-1 rounded-md border transition-colors"
            style={
              speed === s
                ? { background: "#f59e0b", color: "#1a0800", borderColor: "#f59e0b" }
                : { background: "transparent", color: "#7a5c38", borderColor: "#3d2010" }
            }
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Voice mode toggle + status dot */}
      <div className="flex items-center gap-1.5">
        {aiStatusDot && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: aiStatusDot.color }}
            title={aiStatusDot.title}
          />
        )}
        <button
          onClick={() => onTTSModeChange(ttsMode === "ai" ? "web" : "ai")}
          className="text-xs px-2.5 py-1.5 rounded-lg border transition-all"
          title={
            ttsMode === "ai"
              ? "Using AI voice (ElevenLabs) — click to switch to robotic"
              : "Using robotic voice — click to try AI voice"
          }
          style={
            ttsMode === "ai"
              ? { background: "#1a1a3a", color: "#a78bfa", borderColor: "#3a2a6a" }
              : { background: "#1a1008", color: "#7a5c38", borderColor: "#3d2010" }
          }
        >
          {ttsMode === "ai" ? "✨ AI" : "🤖 Robotic"}
        </button>
      </div>
    </div>
  )
}
