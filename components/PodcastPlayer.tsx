"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import KatakanaToggle from "@/components/KatakanaToggle"
import { PODCAST_TOPICS, TOPIC_CATEGORY_LABEL } from "@/lib/podcast-topics"
import { buildRotation, planSegment, SEGMENTS_PER_TOPIC, type PlannedSegment } from "@/lib/podcast-plan"
import {
  setMediaSessionHandlers,
  clearMediaSession,
  updateMediaSessionMetadata,
  setMediaSessionPlaybackState,
} from "@/lib/media-session"
import type { PodcastTopic } from "@/lib/podcast-topics"
import { speakLine, cancelSpeech, initBackgroundAudio, setTTSMode, prefetchLineAudio, toSpeechText } from "@/lib/tts"
import { useVoices } from "@/components/VoiceProvider"
import { roleForSpeaker } from "@/lib/voices"
import VoicePicker from "@/components/VoicePicker"
import type { TTSMode } from "@/lib/tts"
import PodcastTranscript from "./PodcastTranscript"
import PodcastControls from "./PodcastControls"

export type PodcastLine = {
  id: string
  speaker: "A" | "B"
  content: string
  isPlaying: boolean
  timestamp: number
}

type HistoryEntry = { speaker: "A" | "B"; content: string }

const DIFFICULTIES = ["N5", "N4", "N3"] as const
type Difficulty = (typeof DIFFICULTIES)[number]

const MAX_TRANSCRIPT = 40
const TURN_TIMEOUT_MS = 20_000
const GAP_MS = 400

async function fetchTurn(
  topic: PodcastTopic,
  difficulty: Difficulty,
  speaker: "A" | "B",
  history: HistoryEntry[],
  kind: "dialogue" | "explain" = "dialogue",
  move?: string
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS)
  try {
    const res = await fetch("/api/podcast/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic.label, difficulty, seed: topic.seed, speaker, history, kind, move,
      }),
      signal: controller.signal,
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let text = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    return text.trim().replace(/^(Kenji|Wei)[:：]\s*/i, "")
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWithRetry(
  topic: PodcastTopic,
  difficulty: Difficulty,
  speaker: "A" | "B",
  history: HistoryEntry[],
  kind: "dialogue" | "explain" = "dialogue",
  move?: string
): Promise<string | null> {
  try { return await fetchTurn(topic, difficulty, speaker, history, kind, move) } catch {}
  try { return await fetchTurn(topic, difficulty, speaker, history, kind, move) } catch {}
  return null
}

const STORAGE_KEY = "podcast_prefs"

function loadPrefs() {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") } catch { return null }
}

function savePrefs(prefs: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch {}
}

export default function PodcastPlayer() {
  const prefs = typeof window !== "undefined" ? loadPrefs() : null

  const [transcript, setTranscript] = useState<PodcastLine[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentSpeaker, setCurrentSpeaker] = useState<"A" | "B">("A")
  const [topic, setTopic] = useState<PodcastTopic>(
    PODCAST_TOPICS.find(t => t.id === prefs?.topicId) ?? PODCAST_TOPICS[0]
  )
  const [difficulty, setDifficulty] = useState<Difficulty>(prefs?.difficulty ?? "N4")
  const [speed, setSpeed] = useState<number>(prefs?.speed ?? 1)
  const [volume, setVolume] = useState<number>(prefs?.volume ?? 0.9)
  const [ttsMode, setTtsModeState] = useState<TTSMode>(prefs?.ttsMode ?? "ai")
  const [aiWorking, setAiWorking] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isPlayingRef = useRef(false)
  const loopGenRef = useRef(0)
  const currentSpeakerRef = useRef<"A" | "B">("A")
  const historyRef = useRef<HistoryEntry[]>([])
  const topicRef = useRef<PodcastTopic>(PODCAST_TOPICS[0])
  const difficultyRef = useRef<Difficulty>("N4")
  const speedRef = useRef(1)
  const volumeRef = useRef(0.9)
  // The playback loop outlives any single render, so it reads the current voice
  // choice through a ref — changing a voice mid-episode takes effect next line.
  const { voiceFor } = useVoices()
  const voiceRef = useRef(voiceFor)
  const ttsModeRef = useRef<TTSMode>("ai")
  // Resolver for the inter-turn gap — calling it skips the wait
  const skipGapRef = useRef<(() => void) | null>(null)
  // Rotation order and playhead. The loop reads these, so they are refs; the
  // rotation is rebuilt whenever the starting topic changes.
  const rotationRef = useRef(buildRotation(PODCAST_TOPICS))
  const segmentIndexRef = useRef(0)
  const [nowTopic, setNowTopic] = useState(rotationRef.current[0])
  // Media Session handlers are registered once, before these functions exist;
  // refs let that single registration reach the current implementations.
  const startLoopRef = useRef<(() => void) | null>(null)
  const nextTopicRef = useRef<(() => void) | null>(null)

  useEffect(() => { topicRef.current = topic }, [topic])
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])
  useEffect(() => { voiceRef.current = voiceFor }, [voiceFor])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { volumeRef.current = volume }, [volume])
  useEffect(() => { initBackgroundAudio() }, [])

  // Car head units render none of this page — they read Media Session metadata
  // and send button presses back through these handlers.
  useEffect(() => {
    setMediaSessionHandlers({
      onPlay: () => { if (!isPlayingRef.current) startLoopRef.current?.() },
      onPause: () => {
        isPlayingRef.current = false
        setIsPlaying(false)
        setIsGenerating(false)
        cancelSpeech()
        skipGapRef.current?.()
      },
      onNextTopic: () => nextTopicRef.current?.(),
      onReplay: () => { cancelSpeech(); skipGapRef.current?.() },
    })
    return clearMediaSession
  }, [])

  useEffect(() => {
    setMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
  }, [isPlaying])

  // Stop everything when navigating away — prevents audio playing in background
  useEffect(() => {
    return () => {
      loopGenRef.current++       // invalidates the running loop's gen check
      isPlayingRef.current = false
      cancelSpeech()             // stops audio + resolves any pending promise
      skipGapRef.current?.()     // releases any gap timer
    }
  }, [])

  // Persist user preferences
  useEffect(() => {
    savePrefs({ topicId: topic.id, difficulty, speed, volume, ttsMode })
  }, [topic.id, difficulty, speed, volume, ttsMode])

  function handleTTSModeChange(m: TTSMode) {
    setTTSMode(m); setTtsModeState(m); ttsModeRef.current = m; setAiWorking(null)
  }

  // Gap that can be cut short by handleSkip
  function gap(ms: number): Promise<void> {
    return new Promise(resolve => {
      const t = setTimeout(() => { skipGapRef.current = null; resolve() }, ms)
      skipGapRef.current = () => { clearTimeout(t); skipGapRef.current = null; resolve() }
    })
  }

  const runPodcastLoop = useCallback(async (gen: number) => {
    // nextLinePrefetch resolves with the NEXT turn's text *and* its audio.
    // Both are started while the current line is still speaking, so neither the
    // model call nor the (slower) speech synthesis sits on the critical path.
    type Prefetched = { text: string; audio: Promise<Blob | null>; plan: PlannedSegment } | null
    let nextLinePrefetch: Promise<Prefetched> | null = null

    while (isPlayingRef.current && loopGenRef.current === gen) {
      const plan = planSegment(segmentIndexRef.current, rotationRef.current)
      const speaker = plan.speaker

      let line: string | null = null
      // Audio for this line, if it was fetched ahead of time.
      let audioPromise: Promise<Blob | null> | null = null

      if (nextLinePrefetch) {
        // Line was pre-fetched while the previous one was playing
        setIsGenerating(true)
        const pre = await nextLinePrefetch
        nextLinePrefetch = null
        line = pre?.text ?? null
        audioPromise = pre?.audio ?? null
        setIsGenerating(false)
      } else {
        // First turn or after a reset — nothing is warm yet, so this one waits.
        setIsGenerating(true)
        line = await fetchWithRetry(
          plan.topic, difficultyRef.current, speaker, historyRef.current, plan.kind, plan.move
        )
        setIsGenerating(false)
      }

      // Announce the topic to the car before its first line plays.
      if (plan.startsTopic) {
        setNowTopic(plan.topic)
        updateMediaSessionMetadata({
          topicLabel: plan.topic.label,
          topicLabelZh: plan.topic.labelZh,
          speakerLabel: speaker === "A" ? "Kenji · 日本語" : "Wei · 中文",
        })
      }

      if (!isPlayingRef.current || loopGenRef.current !== gen) break
      if (!line?.trim()) { setErrorMsg("连接失败，请重试"); isPlayingRef.current = false; setIsPlaying(false); break }
      setErrorMsg(null)

      const newLine: PodcastLine = {
        id: crypto.randomUUID(),
        speaker,
        content: line,
        isPlaying: true,
        timestamp: Date.now(),
      }
      historyRef.current = [...historyRef.current.slice(-7), { speaker, content: line }]
      setTranscript(prev => [
        ...prev.slice(-(MAX_TRANSCRIPT - 1)).map(l => ({ ...l, isPlaying: false })),
        newLine,
      ])

      // Kick off the next segment's fetch + gap in parallel with the current line
      const nextPlan = planSegment(segmentIndexRef.current + 1, rotationRef.current)
      const nextSpeaker = nextPlan.speaker
      const snapHistory = historyRef.current
      const snapDiff = difficultyRef.current
      const myGen = gen

      nextLinePrefetch = gap(GAP_MS).then(async () => {
        if (!isPlayingRef.current || loopGenRef.current !== myGen) return null
        const text = await fetchWithRetry(
          nextPlan.topic, snapDiff, nextSpeaker, snapHistory, nextPlan.kind, nextPlan.move
        )
        if (!text?.trim()) return null
        if (!isPlayingRef.current || loopGenRef.current !== myGen) return null
        // Start synthesis immediately and do NOT await it — it runs while the
        // current line is still playing, which is the whole point.
        return {
          text,
          plan: nextPlan,
          audio: prefetchLineAudio(text, nextSpeaker, voiceRef.current(roleForSpeaker(nextSpeaker))),
        }
      })

      const speakText = toSpeechText(line)
      // Awaiting here costs nothing when the prefetch already finished during
      // playback of the previous line.
      const prefetchedAudio = audioPromise ? await audioPromise : null
      const usedAI = await speakLine(
        speakText, speaker, speedRef.current, volumeRef.current, prefetchedAudio,
        voiceRef.current(roleForSpeaker(speaker))
      )
      if (ttsModeRef.current === "ai") setAiWorking(usedAI)

      setTranscript(prev => prev.map(l => l.id === newLine.id ? { ...l, isPlaying: false } : l))

      if (!isPlayingRef.current || loopGenRef.current !== gen) break

      // Advance the playhead; the planner derives speaker and topic from it.
      segmentIndexRef.current += 1
      currentSpeakerRef.current = nextSpeaker
      setCurrentSpeaker(nextSpeaker)
    }
  }, [gap])

  function startLoop() {
    const gen = ++loopGenRef.current
    isPlayingRef.current = true
    setIsPlaying(true)
    setErrorMsg(null)
    runPodcastLoop(gen)
  }

  function reset() {
    loopGenRef.current++
    isPlayingRef.current = false
    cancelSpeech()
    skipGapRef.current?.()
    historyRef.current = []
    currentSpeakerRef.current = "A"
    setCurrentSpeaker("A")
    // Without this the playhead keeps its old position, so a reset would resume
    // mid-rotation on an unrelated topic.
    segmentIndexRef.current = 0
    setNowTopic(rotationRef.current[0])
    setTranscript([])
    setIsGenerating(false)
    setErrorMsg(null)
  }

  function handlePlay() { if (!isPlayingRef.current) startLoop() }
  function handlePause() { isPlayingRef.current = false; setIsPlaying(false); setIsGenerating(false); cancelSpeech(); skipGapRef.current?.() }
  function handleSkip() { cancelSpeech(); skipGapRef.current?.() }

  /** Jump to the start of the next topic in the rotation. */
  const handleNextTopic = useCallback(() => {
    const per = SEGMENTS_PER_TOPIC
    segmentIndexRef.current = (Math.floor(segmentIndexRef.current / per) + 1) * per
    currentSpeakerRef.current = "A"
    setCurrentSpeaker("A")
    historyRef.current = []   // a new topic should not inherit the old thread
    cancelSpeech()
    skipGapRef.current?.()
  }, [])

  // Media Session registered its handlers once, before these functions existed;
  // keep the refs pointing at the current ones on every render.
  useEffect(() => {
    startLoopRef.current = startLoop
    nextTopicRef.current = handleNextTopic
  })

  function handleTopicChange(t: PodcastTopic) {
    const was = isPlayingRef.current
    reset()
    setTopic(t); topicRef.current = t
    // Rebuild the rotation to start here, so the picker chooses the opening
    // topic rather than the only one.
    rotationRef.current = buildRotation(PODCAST_TOPICS, t.id)
    segmentIndexRef.current = 0
    setNowTopic(rotationRef.current[0])
    if (was) startLoop()
  }

  function handleDifficultyChange(d: Difficulty) {
    const was = isPlayingRef.current
    reset()
    setDifficulty(d); difficultyRef.current = d
    if (was) startLoop()
  }

  function handleCopy() {
    const text = transcript
      .map(l => `${l.speaker === "A" ? "Kenji" : "Wei"}: ${l.content.replace(/\([^)）]+\)/g, "").trim()}`)
      .join("\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const kenjiActive = currentSpeaker === "A" && isPlaying
  const weiActive   = currentSpeaker === "B" && isPlaying

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "#1a1008" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#3d2010", background: "#1e0e04" }}>
        <Link href="/" className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ color: "#f59e0b", borderColor: "#5c3d1e" }}>← 戻る</Link>

        <div className="flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <span className="font-bold text-lg" style={{ color: "#f59e0b", fontFamily: "serif" }}>
            物語 Podcast
          </span>
        </div>

        <div className="flex items-center gap-2">
        <KatakanaToggle />
        {/* Copy transcript */}
        <button
          onClick={handleCopy}
          disabled={transcript.length === 0}
          className="text-xs px-2.5 py-1.5 rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ color: copied ? "#4ade80" : "#7a5c38", borderColor: "#3d2010" }}
          title="Copy transcript"
        >
          {copied ? "✓ 已复制" : "复制对话"}
        </button>
        </div>
      </div>

      {/* Topic / Difficulty */}
      <div className="flex flex-wrap gap-3 items-center px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: "#3d2010" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#7a5c38" }}>开始话题</span>
          <select className="text-sm rounded-lg px-2 py-1 border"
            style={{ background: "#261508", color: "#f0d5a0", borderColor: "#5c3d1e" }}
            value={topic.id}
            onChange={e => {
              const found = PODCAST_TOPICS.find(t => t.id === e.target.value)
              if (found) handleTopicChange(found)
            }}>
            {PODCAST_TOPICS.map(t => (
              <option key={t.id} value={t.id}>
                {t.emoji} {t.labelZh} · {TOPIC_CATEGORY_LABEL[t.category]}
              </option>
            ))}
          </select>
          <button
            onClick={handleNextTopic}
            title="跳到下一个话题"
            className="text-xs px-2 py-1 rounded-lg border transition-colors"
            style={{ background: "transparent", color: "#a07850", borderColor: "#3d2010" }}
          >
            下一个 ⏭
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#7a5c38" }}>難易度</span>
          <select className="text-sm rounded-lg px-2 py-1 border"
            style={{ background: "#261508", color: "#f0d5a0", borderColor: "#5c3d1e" }}
            value={difficulty}
            onChange={e => handleDifficultyChange(e.target.value as Difficulty)}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Speakers — each with the voice that speaks for them */}
      <div className="flex justify-between items-start gap-3 px-6 py-2.5 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: "#3d2010" }}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="text-2xl">🇯🇵</span>
            {kenjiActive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#ef4444" }} />}
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-sm font-bold" style={{ color: "#fca5a5" }}>Kenji</div>
            <VoicePicker role="narrator" label="" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <div className="text-xs" style={{ color: "#5c3d1e" }}>⟵ 会話 ⟶</div>
          {nowTopic ? (
            <div className="text-xs whitespace-nowrap" style={{ color: "#a07850" }}>
              {nowTopic.emoji} {nowTopic.labelZh}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1 items-end">
            <div className="text-sm font-bold" style={{ color: "#5eead4" }}>Wei</div>
            <VoicePicker role="chinese" label="" />
          </div>
          <div className="relative">
            <span className="text-2xl">🇨🇳</span>
            {weiActive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#14b8a6" }} />}
          </div>
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ background: "#3d0a0a", borderBottom: "1px solid #7a1a1a" }}>
          <span className="text-sm" style={{ color: "#fca5a5" }}>⚠ {errorMsg}</span>
          <button onClick={startLoop} className="text-xs px-3 py-1 rounded-md"
            style={{ background: "#7a1a1a", color: "#fca5a5" }}>重试</button>
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 min-h-0">
        <PodcastTranscript transcript={transcript} isGenerating={isGenerating} currentSpeaker={currentSpeaker} />
      </div>

      {/* Controls */}
      <div className="flex-shrink-0">
        <PodcastControls
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onSkip={handleSkip}
          speed={speed}
          onSpeedChange={setSpeed}
          volume={volume}
          onVolumeChange={setVolume}
          ttsMode={ttsMode}
          onTTSModeChange={handleTTSModeChange}
          aiWorking={aiWorking}
        />
      </div>
    </div>
  )
}
