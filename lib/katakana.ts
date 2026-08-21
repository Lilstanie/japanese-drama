import { lookupLoanword, NON_LOANWORDS, MAX_TERM_LENGTH } from "@/lib/katakana-dict"

export type KatakanaSegment =
  | { type: "text"; text: string }
  | { type: "katakana"; term: string; gloss: string | null; src?: string }

/**
 * A katakana run. `・` and `＝` are deliberately excluded so compound loanwords
 * (アイス・コーヒー) split into separately-glossable terms instead of one blob.
 */
const KATAKANA_RUN = /[ァ-ヺー]+/g

/** Single characters are ambiguous noise (ト as "to"?), so only gloss 2+ chars. */
const MIN_TERM_LENGTH = 2

export function isKatakanaTerm(s: string): boolean {
  return /^[ァ-ヺー]+$/.test(s)
}

type Match = { term: string; gloss: string; src?: string }

/** A known gloss for exactly `term`, from the runtime cache or the dictionary. */
function matchTerm(
  term: string,
  extraGlosses?: Map<string, string | null>
): Match | null {
  const runtime = extraGlosses?.get(term)
  if (runtime) return { term, gloss: runtime }

  const entry = lookupLoanword(term)
  if (entry) return { term, gloss: entry.en, src: entry.src }

  return null
}

/**
 * Split one katakana run into dictionary terms.
 *
 * This searches for a segmentation covering the WHOLE run rather than scanning
 * greedily left to right. Greedy scanning shreds unknown compounds on any
 * interior word it happens to recognise — ジェットコースター becomes
 * ジェット + コース("course") + ター, which is both wrong and sends meaningless
 * fragments to the gloss API. Requiring a full cover means a run either
 * segments cleanly into known loanwords or is left whole for the LLM to gloss
 * as one word (コーヒーゼリー → "coffee jelly").
 *
 * Among full covers the one with the fewest terms wins, so アイスコーヒー
 * ("iced coffee") beats アイス + コーヒー.
 */
function segmentRun(
  run: string,
  extraGlosses?: Map<string, string | null>
): KatakanaSegment[] {
  const n = run.length

  // best[i] = fewest-term cover of run[i..n), or null if none exists.
  const best: ({ count: number; parts: Match[] } | null)[] = new Array(n + 1).fill(null)
  best[n] = { count: 0, parts: [] }

  for (let i = n - 1; i >= 0; i--) {
    const maxLen = Math.min(MAX_TERM_LENGTH, n - i)
    for (let len = MIN_TERM_LENGTH; len <= maxLen; len++) {
      const rest = best[i + len]
      if (!rest) continue

      const match = matchTerm(run.slice(i, i + len), extraGlosses)
      if (!match) continue

      const count = rest.count + 1
      if (!best[i] || count < best[i]!.count) {
        best[i] = { count, parts: [match, ...rest.parts] }
      }
    }
  }

  const cover = best[0]
  if (cover) {
    return cover.parts.map((m) => ({
      type: "katakana" as const,
      term: m.term,
      gloss: m.gloss,
      src: m.src,
    }))
  }

  // No clean segmentation — hand the whole run to the gloss layer intact.
  if (n >= MIN_TERM_LENGTH && !NON_LOANWORDS.has(run)) {
    return [{ type: "katakana", term: run, gloss: null }]
  }
  return [{ type: "text", text: run }]
}

/** Split plain text into glossed katakana terms and everything else. */
export function parseKatakanaSegments(
  text: string,
  extraGlosses?: Map<string, string | null>
): KatakanaSegment[] {
  const segments: KatakanaSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  KATAKANA_RUN.lastIndex = 0
  while ((match = KATAKANA_RUN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, match.index) })
    }
    segments.push(...segmentRun(match[0], extraGlosses))
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) })
  }

  return segments
}

/**
 * Katakana terms in `text` that have no gloss yet — the work list for the
 * on-demand LLM lookup. `resolved` carries terms already looked up (including
 * ones the model rejected as non-loanwords, stored as null) so we never ask twice.
 */
export function collectUnglossedTerms(
  text: string,
  resolved: Map<string, string | null>
): string[] {
  const terms = new Set<string>()

  for (const seg of parseKatakanaSegments(text, resolved)) {
    if (seg.type !== "katakana") continue
    if (seg.gloss) continue
    if (resolved.has(seg.term)) continue
    terms.add(seg.term)
  }

  return [...terms]
}
