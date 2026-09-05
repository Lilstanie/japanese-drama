import { concatWav, parseWav, silence, type WavFormat } from "@/lib/wav"
import { planSegment, type PlannedSegment, type Situation } from "@/lib/podcast-plan"
import type { PodcastTopic } from "@/lib/podcast-topics"

/**
 * Assembling a stretch of podcast into one audio file.
 *
 * Playing a queue of clips needs JS between them, and a backgrounded tab has
 * its timers throttled — so playback stops when the screen locks, which is
 * exactly when a driver needs it. One long audio element keeps playing, so a
 * run of segments is generated ahead, spliced together, and handed over as a
 * single file.
 *
 * The per-segment offsets survive the splice, so the transcript still tracks
 * the audio.
 *
 * Network calls are injected rather than imported: the assembly rules — what to
 * do when one line fails, how gaps are placed, where each segment lands — are
 * the part worth testing, and they should be testable without a model or a TTS
 * provider.
 */

export type EpisodeSegment = PlannedSegment & {
  text: string
  /** Seconds from the start of the episode. */
  startSec: number
  endSec: number
}

export type Episode = {
  /** The whole stretch as one file. */
  audio: Blob
  segments: EpisodeSegment[]
  duration: number
  /** Segment index the next episode should start from. */
  nextIndex: number
}

export type BuildDeps = {
  /** Resolve a segment's text, or null if it could not be generated. */
  fetchText: (plan: PlannedSegment, history: HistoryEntry[]) => Promise<string | null>
  /** Synthesise a segment, or null on failure. */
  fetchAudio: (plan: PlannedSegment, text: string) => Promise<ArrayBuffer | null>
  /** Called after each segment, to report progress and allow cancellation. */
  onProgress?: (done: number, total: number) => void
  /** Return false to stop early — the listener pressed pause or navigated away. */
  shouldContinue?: () => boolean
}

export type HistoryEntry = { speaker: "A" | "B"; content: string }

/** Pause between speakers. Long enough to hear a turn change, short enough not to drag. */
export const GAP_SECONDS = 0.45

/** Segments per episode. Twelve is one topic — see SEGMENTS_PER_TOPIC. */
export const DEFAULT_EPISODE_LENGTH = 12

export type BuildOptions = {
  startIndex: number
  count?: number
  rotation: PodcastTopic[]
  situationFor: (plan: PlannedSegment) => Situation
  history?: HistoryEntry[]
}

/**
 * Generate and splice a stretch of conversation.
 *
 * A segment that fails to generate — or fails to synthesise — is dropped rather
 * than aborting the episode, so one bad line costs a sentence instead of the
 * whole drive. Returns null only when nothing at all could be produced.
 */
export async function buildEpisode(
  opts: BuildOptions,
  deps: BuildDeps
): Promise<Episode | null> {
  const count = opts.count ?? DEFAULT_EPISODE_LENGTH
  const history: HistoryEntry[] = [...(opts.history ?? [])]

  const texts: { plan: PlannedSegment; text: string; audio: Uint8Array }[] = []

  for (let n = 0; n < count; n++) {
    if (deps.shouldContinue && !deps.shouldContinue()) break

    const plan = planSegment(opts.startIndex + n, opts.rotation)
    const text = await deps.fetchText(plan, history.slice(-8))
    if (!text?.trim()) continue

    const audio = await deps.fetchAudio(plan, text)
    if (!audio) continue

    texts.push({ plan, text, audio: new Uint8Array(audio) })
    history.push({ speaker: plan.speaker, content: text })
    deps.onProgress?.(texts.length, count)
  }

  if (texts.length === 0) return null

  // Splicing needs uncompressed PCM. A compressed provider (ElevenLabs returns
  // MP3) cannot be joined this way; the caller falls back to per-clip playback.
  let format: WavFormat
  try {
    format = parseWav(texts[0]!.audio).format
  } catch {
    return null
  }

  const pieces: Uint8Array[] = []
  const gap = silence(format, GAP_SECONDS)
  for (const [i, t] of texts.entries()) {
    if (i > 0) pieces.push(gap)
    pieces.push(t.audio)
  }

  let spliced
  try {
    spliced = concatWav(pieces)
  } catch {
    // A clip with a different sample rate would play at the wrong pitch.
    return null
  }

  const segments: EpisodeSegment[] = texts.map((t, i) => {
    // Offsets alternate clip, gap, clip … so segment i is at position 2i.
    const start = spliced.offsets[i === 0 ? 0 : i * 2]!
    const next = spliced.offsets[i * 2 + 1]
    return {
      ...t.plan,
      text: t.text,
      startSec: start,
      endSec: next ?? spliced.duration,
    }
  })

  return {
    audio: new Blob([spliced.wav as unknown as BlobPart], { type: "audio/wav" }),
    segments,
    duration: spliced.duration,
    nextIndex: opts.startIndex + count,
  }
}

/** The segment playing at `seconds`, for highlighting the transcript. */
export function segmentAt(
  segments: EpisodeSegment[],
  seconds: number
): EpisodeSegment | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (seconds >= segments[i]!.startSec) return segments[i]!
  }
  return segments[0] ?? null
}
