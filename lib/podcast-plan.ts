import {
  PODCAST_TOPICS,
  type PodcastTopic,
  type TopicCategory,
} from "@/lib/podcast-topics"

/**
 * Decides what the podcast says next.
 *
 * Kept separate from the player because the interesting decisions — when to
 * change topic, when Wei should stop chatting and explain something in Chinese
 * — are pure functions of the segment index, and are worth testing without a
 * browser or a model.
 */

export type SegmentKind = "dialogue" | "explain"

export type PlannedSegment = {
  index: number
  topic: PodcastTopic
  speaker: "A" | "B"
  kind: SegmentKind
  /** Which language this segment is spoken in — drives voice and TTS locale. */
  lang: "ja" | "zh"
  /** True on the first segment of a topic, so the UI can announce the change. */
  startsTopic: boolean
}

/** Segments spent on one topic before moving on. ~12 is a few minutes of audio. */
export const SEGMENTS_PER_TOPIC = 12

/**
 * How often Wei explains instead of chatting. Every 6th segment lands on one of
 * Wei's turns (he takes the odd indices), so this reads as an occasional aside
 * rather than a lesson interrupting a conversation.
 */
export const EXPLAIN_EVERY = 6

/**
 * Order topics so consecutive ones come from different categories.
 *
 * Playing three 日常 topics in a row makes a long drive feel like one
 * conversation that will not end, which is the thing rotation is meant to fix.
 * Falls back to source order when no different category is available.
 */
export function buildRotation(
  topics: PodcastTopic[] = PODCAST_TOPICS,
  startId?: string
): PodcastTopic[] {
  const pool = [...topics]
  if (pool.length === 0) return []

  const startIdx = startId ? pool.findIndex((t) => t.id === startId) : -1
  const first = startIdx >= 0 ? pool.splice(startIdx, 1)[0]! : pool.shift()!
  const ordered: PodcastTopic[] = [first]
  let lastCategory: TopicCategory = first.category

  while (pool.length) {
    // Take from whichever *other* category has the most left. Picking merely
    // the first different one lets the largest category run out last and
    // cluster at the end — with 7 日常 topics of 24 that produced three
    // same-category pairs in a row.
    const remaining = new Map<TopicCategory, number>()
    for (const t of pool) {
      remaining.set(t.category, (remaining.get(t.category) ?? 0) + 1)
    }

    let bestCategory: TopicCategory | null = null
    let bestCount = -1
    for (const [category, count] of remaining) {
      if (category === lastCategory) continue
      if (count > bestCount) { bestCategory = category; bestCount = count }
    }

    // Only one category left — unavoidable repeat.
    const next = bestCategory
      ? pool.findIndex((t) => t.category === bestCategory)
      : 0

    const [picked] = pool.splice(next, 1)
    ordered.push(picked!)
    lastCategory = picked!.category
  }

  return ordered
}

/**
 * What plays at `index`.
 *
 * Speakers alternate — Kenji (Japanese) on even indices, Wei on odd — so the
 * explain turns fall naturally to Wei, who already speaks Chinese.
 */
export function planSegment(
  index: number,
  rotation: PodcastTopic[]
): PlannedSegment {
  if (rotation.length === 0) {
    throw new Error("planSegment needs at least one topic")
  }

  const topicIndex = Math.floor(index / SEGMENTS_PER_TOPIC) % rotation.length
  const topic = rotation[topicIndex]!
  const speaker: "A" | "B" = index % 2 === 0 ? "A" : "B"

  // Only Wei explains, and only on his own turn, so alternation is untouched.
  // The offset matters: Wei holds the odd indices, so `index % EXPLAIN_EVERY`
  // would only ever land on Kenji and no explanation would ever play.
  const kind: SegmentKind =
    speaker === "B" && (index + 1) % EXPLAIN_EVERY === 0
      ? "explain"
      : "dialogue"

  return {
    index,
    topic,
    speaker,
    kind,
    lang: speaker === "A" ? "ja" : "zh",
    startsTopic: index % SEGMENTS_PER_TOPIC === 0,
  }
}

/** Segment index at which `rotation[i]` starts — used to skip a topic. */
export function segmentIndexForTopic(topicPosition: number): number {
  return topicPosition * SEGMENTS_PER_TOPIC
}
