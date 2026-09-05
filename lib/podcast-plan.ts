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

/**
 * What a turn is *for*.
 *
 * Without this the only instruction is "be natural and short", and natural +
 * short + agreeable collapses into Japanese closure formulas — 〜してみてね,
 * 楽しみにしてる, 感想を聞かせて. Those are always a valid reply, so once both
 * speakers enter that mode neither has any reason to leave, and the
 * conversation loops while every individual line still looks fine.
 *
 * Giving each turn a job is what keeps it moving. This is not a context-window
 * problem: the looping happens well inside the 8 turns of history the model
 * already sees.
 */
export type ConversationMove =
  | "open"      // set the scene with one concrete hook
  | "ask"       // ask the other something specific
  | "detail"    // add a concrete fact, place, number or name
  | "contrast"  // compare Japan and China
  | "anecdote"  // tell a short personal story
  | "disagree"  // push back, or admit a dislike
  | "shift"     // move to a neighbouring angle of the topic
  | "close"     // land a small conclusion before the topic changes

/**
 * The arc of one topic: open, develop, deepen, then land it.
 *
 * Fixed rather than random so it is deterministic and testable, and so the same
 * topic does not open the same way every rotation — the move depends on
 * position within the topic, and the topics themselves rotate.
 */
const MOVE_CYCLE: ConversationMove[] = [
  "open",     // 0
  "ask",      // 1
  "detail",   // 2
  "contrast", // 3
  "anecdote", // 4
  "ask",      // 5
  "disagree", // 6
  "detail",   // 7
  "shift",    // 8
  "anecdote", // 9
  "ask",      // 10
  "close",    // 11
]

export type PlannedSegment = {
  index: number
  topic: PodcastTopic
  speaker: "A" | "B"
  kind: SegmentKind
  /** Which language this segment is spoken in — drives voice and TTS locale. */
  lang: "ja" | "zh"
  /** True on the first segment of a topic, so the UI can announce the change. */
  startsTopic: boolean
  /** What this turn should accomplish — see ConversationMove. */
  move: ConversationMove
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

  const positionInTopic = index % SEGMENTS_PER_TOPIC

  return {
    index,
    topic,
    speaker,
    kind,
    lang: speaker === "A" ? "ja" : "zh",
    startsTopic: positionInTopic === 0,
    move: MOVE_CYCLE[positionInTopic % MOVE_CYCLE.length]!,
  }
}

/**
 * A concrete situation for a topic, injected into the prompt.
 *
 * Sampling parameters vary *wording*; they cannot vary the frame. Measured at
 * the default temperature, five openings on the same topic all came out as
 * "time + place + what I ate + んだけど" — different nouns, identical shape,
 * because the instruction fixed the shape. Changing the inputs is what changes
 * the conversation.
 */
export type Situation = { season: string; setting: string; mood: string }

const SEASONS = [
  "春、桜が散り始めた頃", "梅雨で毎日雨", "真夏、猛暑日が続いている",
  "秋、紅葉がきれいな時期", "冬、初雪が降った日", "年末、街が慌ただしい",
]

const SETTINGS = [
  "電話で話している", "カフェで向かい合っている", "駅まで歩きながら",
  "居酒屋のカウンターで", "オンライン通話で、少し音が悪い",
  "コンビニの前で立ち話している", "電車で隣に座っている",
]

const MOODS = [
  "二人とも機嫌がいい", "Kenjiは少し疲れていて口数が少なめ",
  "Weiが何かに驚いている", "二人とも少し空腹",
  "Kenjiが最近あった出来事にまだ興奮している",
  "Weiがちょっと落ち込んでいる", "二人とも寝不足",
]

const pick = <T,>(xs: T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)]!

/** A random situation. Pass `rnd` to make it deterministic in tests. */
export function pickSituation(rnd: () => number = Math.random): Situation {
  return {
    season: pick(SEASONS, rnd),
    setting: pick(SETTINGS, rnd),
    mood: pick(MOODS, rnd),
  }
}

/**
 * Fisher-Yates. Used to vary topic order between sessions — a fixed rotation
 * means the same drive always opens the same way.
 */
export function shuffle<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Segment index at which `rotation[i]` starts — used to skip a topic. */
export function segmentIndexForTopic(topicPosition: number): number {
  return topicPosition * SEGMENTS_PER_TOPIC
}
