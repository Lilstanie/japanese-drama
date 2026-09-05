"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import KatakanaToggle from "@/components/KatakanaToggle"
import { PODCAST_TOPICS, TOPIC_CATEGORY_LABEL } from "@/lib/podcast-topics"
import { buildRotation, pickSituation, shuffle, SEGMENTS_PER_TOPIC, type Situation } from "@/lib/podcast-plan"
import {
  buildEpisode, segmentAt, DEFAULT_EPISODE_LENGTH,
  type Episode, type BuildDeps,
} from "@/lib/podcast-episode"
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
/**
 * The opening stretch is shorter so playback starts sooner, but not so short
 * that the next episode cannot be built before it ends.
 *
 * Measured against the real providers: ~3.1s to generate a segment, ~9.3s to
 * play one. A 12-segment episode therefore takes ~38s to build, so the opening
 * stretch has to cover at least that. Four segments plays for 37s — 0.7s short,
 * a stall at the very first changeover. Six plays for ~56s, leaving ~18s of
 * margin for a slow response.
 */
const FIRST_EPISODE_LENGTH = 6

async function fetchTurn(
  topic: PodcastTopic,
  difficulty: Difficulty,
  speaker: "A" | "B",
  history: HistoryEntry[],
  kind: "dialogue" | "explain" = "dialogue",
  move?: string,
  situation?: Situation
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TURN_TIMEOUT_MS)
  try {
    const res = await fetch("/api/podcast/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic.label, difficulty, seed: topic.seed, speaker, history, kind, move, situation,
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
  move?: string,
  situation?: Situation
): Promise<string | null> {
  try { return await fetchTurn(topic, difficulty, speaker, history, kind, move, situation) } catch {}
  try { return await fetchTurn(topic, difficulty, speaker, history, kind, move, situation) } catch {}
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
  // Deterministic on purpose. Shuffling here ran Math.random() during render,
  // on the server as well as the client, so the two disagreed about the first
  // topic and hydration failed. Randomisation happens on play instead — a
  // client-only event, and the only moment the order starts to matter.
  const rotationRef = useRef(buildRotation(PODCAST_TOPICS))
  const segmentIndexRef = useRef(0)
  // One situation per topic — season, setting and mood — so two runs of the
  // same topic differ in more than word choice.
  // Also deferred: as a useRef argument this ran on every render, including on
  // the server, for a value only the first render keeps.
  const situationRef = useRef<Situation | null>(null)
  // The single audio element an episode plays through, and a handle to stop it.
  const episodeAudioRef = useRef<HTMLAudioElement | null>(null)
  const cancelEpisodeRef = useRef<(() => void) | null>(null)
  const [nowTopic, setNowTopic] = useState(rotationRef.current[0])
  // Generation progress, so the wait before the first line is not a blank screen.
  const [buildProgress, setBuildProgress] = useState<{ done: number; total: number } | null>(null)
  // Media Session handlers are registered once, before these functions exist;
  // refs let that single registration reach the current implementations.
  const startLoopRef = useRef<(() => void) | null>(null)
  const nextTopicRef = useRef<(() => void) | null>(null)

  useEffect(() => { topicRef.current = topic }, [topic])
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])
  useEffect(() => { voiceRef.current = voiceFor }, [voiceFor])
  useEffect(() => {
    speedRef.current = speed
    if (episodeAudioRef.current) episodeAudioRef.current.playbackRate = Math.max(0.1, speed)
  }, [speed])
  useEffect(() => {
    volumeRef.current = volume
    if (episodeAudioRef.current) episodeAudioRef.current.volume = Math.max(0, Math.min(1, volume))
  }, [volume])
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
        cancelEpisodeRef.current?.()
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
      cancelEpisodeRef.current?.()
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

  /**
   * Play one episode as a single audio element.
   *
   * Resolves when it finishes or is cancelled. The transcript highlight comes
   * from `timeupdate` against the segment offsets, so many lines stay in sync
   * while the browser sees a single uninterrupted media element — which is what
   * lets it keep playing with the screen off.
   */
  const playEpisode = useCallback((episode: Episode, gen: number) => {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(episode.audio)
      const audio = new Audio(url)
      audio.playbackRate = Math.max(0.1, speedRef.current)
      audio.volume = Math.max(0, Math.min(1, volumeRef.current))
      episodeAudioRef.current = audio

      let done = false
      const finish = () => {
        if (done) return
        done = true
        audio.onended = null
        audio.onerror = null
        audio.ontimeupdate = null
        audio.pause()
        URL.revokeObjectURL(url)
        if (episodeAudioRef.current === audio) episodeAudioRef.current = null
        resolve()
      }

      // Lets pause/skip stop playback from outside this promise.
      cancelEpisodeRef.current = finish

      let lastId: string | null = null
      audio.ontimeupdate = () => {
        if (loopGenRef.current !== gen) { finish(); return }
        const seg = segmentAt(episode.segments, audio.currentTime)
        if (!seg) return
        const id = `${seg.index}`
        if (id !== lastId) {
          lastId = id
          setCurrentSpeaker(seg.speaker)
          setTranscript((prev) =>
            prev.map((l) => ({ ...l, isPlaying: l.id === id }))
          )
          if (seg.topic) setNowTopic(seg.topic)
        }
      }

      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
    })
  }, [])

  /**
   * Play in episodes rather than line by line.
   *
   * A queue of clips needs JS to run between them, and a backgrounded tab has
   * its timers throttled — so the old loop stopped when the screen locked,
   * which is exactly when a driver needs it. A whole topic is generated ahead,
   * spliced into one file, and played as a single audio element, which the
   * browser keeps playing in the background on its own.
   */
  const runPodcastLoop = useCallback(async (gen: number) => {
    const alive = () => isPlayingRef.current && loopGenRef.current === gen

    const makeDeps = (): BuildDeps => ({
      fetchText: (plan, history) =>
        fetchWithRetry(
          plan.topic, difficultyRef.current, plan.speaker, history,
          plan.kind, plan.move, situationRef.current ?? undefined
        ),
      fetchAudio: async (plan, text) => {
        const blob = await prefetchLineAudio(
          text, plan.speaker, voiceRef.current(roleForSpeaker(plan.speaker))
        )
        return blob ? blob.arrayBuffer() : null
      },
      onProgress: (done, total) => { if (alive()) setBuildProgress({ done, total }) },
      shouldContinue: alive,
    })

    const build = (startIndex: number, count: number) =>
      buildEpisode(
        {
          startIndex,
          count,
          rotation: rotationRef.current,
          situationFor: () => situationRef.current ?? pickSituation(),
        },
        makeDeps()
      )

    // The first stretch is short so playback starts sooner; later ones are full
    // length, generated while the previous is still playing.
    // Annotated because the next-episode promise below refers back to this,
    // which TypeScript otherwise sees as circular.
    let episode: Episode | null = await build(segmentIndexRef.current, FIRST_EPISODE_LENGTH)
    setBuildProgress(null)

    if (!episode) {
      if (alive()) {
        setErrorMsg("无法生成内容，请重试")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
      return
    }

    let nextEpisode: Promise<Episode | null> | null = null


    while (alive() && episode) {
      situationRef.current = situationRef.current ?? pickSituation()
      segmentIndexRef.current = episode.nextIndex

      // Show the whole episode at once; the highlight follows playback.
      setTranscript(
        episode.segments.map((s) => ({
          id: `${s.index}`,
          speaker: s.speaker,
          content: s.text,
          isPlaying: false,
          timestamp: Date.now(),
        }))
      )
      historyRef.current = episode.segments
        .slice(-8)
        .map((s) => ({ speaker: s.speaker, content: s.text }))

      const firstTopic = episode.segments[0]?.topic
      if (firstTopic) {
        setNowTopic(firstTopic)
        updateMediaSessionMetadata({
          topicLabel: firstTopic.label,
          topicLabelZh: firstTopic.labelZh,
          speakerLabel: "Kenji · Wei",
        })
      }

      // Start the next episode now, so the changeover is silent.
      const startNext: number = episode.nextIndex
      nextEpisode = (async () => {
        if (!alive()) return null
        situationRef.current = pickSituation()
        return build(startNext, DEFAULT_EPISODE_LENGTH)
      })()

      await playEpisode(episode, gen)
      if (!alive()) break

      episode = await nextEpisode
      nextEpisode = null
      if (!episode && alive()) {
        setErrorMsg("生成中断，请重试")
        isPlayingRef.current = false
        setIsPlaying(false)
      }
    }
  }, [playEpisode])


  function startLoop() {
    // Reorder on a fresh start so no two sessions run the same sequence. Safe
    // here and not during render: this only ever runs from a user action.
    if (segmentIndexRef.current === 0) {
      rotationRef.current = buildRotation(shuffle(PODCAST_TOPICS), topicRef.current.id)
      situationRef.current = pickSituation()
      setNowTopic(rotationRef.current[0])
    }
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
    cancelEpisodeRef.current?.()
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
  function handlePause() {
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsGenerating(false)
    setBuildProgress(null)
    cancelSpeech()
    cancelEpisodeRef.current?.()   // an episode plays as one element, not via speakLine
    skipGapRef.current?.()
  }
  function handleSkip() {
    // Within an episode, skip forward to the next segment boundary.
    const audio = episodeAudioRef.current
    if (audio) {
      audio.currentTime = Math.min(audio.currentTime + 8, (audio.duration || 0) - 0.05)
      return
    }
    cancelSpeech()
    skipGapRef.current?.()
  }

  /** Jump to the start of the next topic in the rotation. */
  const handleNextTopic = useCallback(() => {
    const per = SEGMENTS_PER_TOPIC
    segmentIndexRef.current = (Math.floor(segmentIndexRef.current / per) + 1) * per
    currentSpeakerRef.current = "A"
    setCurrentSpeaker("A")
    historyRef.current = []   // a new topic should not inherit the old thread
    cancelSpeech()
    cancelEpisodeRef.current?.()
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
    rotationRef.current = buildRotation(shuffle(PODCAST_TOPICS), t.id)
    situationRef.current = pickSituation()
    setNowTopic(rotationRef.current[0])
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
        <PodcastTranscript
          buildProgress={buildProgress} transcript={transcript} isGenerating={isGenerating} currentSpeaker={currentSpeaker} />
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
