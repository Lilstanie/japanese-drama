/**
 * Named podcast voices.
 *
 * The podcast has two speakers — A speaks Japanese, B speaks Chinese — and
 * unlike ElevenLabs, Camb AI voices are language-specific: one voice cannot
 * speak both. So each speaker needs a voice from its own language catalogue,
 * and the pairing is what a name has to capture.
 *
 * Names follow `<speaker>-<language>_<gender>_<provider>`, so adding a female
 * Japanese voice or a second provider slots in without renaming anything.
 */

export type VoiceLanguage = "ja" | "zh"

export type NamedVoice = {
  /** Stable name used in config and logs. */
  name: string
  /** Which podcast speaker this voice belongs to. */
  speaker: "A" | "B"
  language: VoiceLanguage
  /** Camb locale tag sent as the `language` field. */
  locale: string
  gender: "male" | "female"
  /** Camb numeric voice id. */
  cambId: number
  /** Camb's own label for the voice, for display and debugging. */
  cambName: string
}

/**
 * Verified against Camb's catalogue: 18 Japanese voices (language code 88) and
 * 37 Mandarin (code 139). The two defaults below are the ones tested end to end.
 */
export const NAMED_VOICES: Record<string, NamedVoice> = {
  "A-japanese_male_camb": {
    name: "A-japanese_male_camb",
    speaker: "A",
    language: "ja",
    locale: "ja-jp",
    gender: "male",
    cambId: 171037,
    cambName: "Haruto Aoki",
  },
  "B-chinese_male_camb": {
    name: "B-chinese_male_camb",
    speaker: "B",
    language: "zh",
    locale: "zh-cn",
    gender: "male",
    cambId: 171145,
    cambName: "Lei Sun",
  },
  // Female alternates — select with CAMB_VOICE_A / CAMB_VOICE_B.
  "A-japanese_female_camb": {
    name: "A-japanese_female_camb",
    speaker: "A",
    language: "ja",
    locale: "ja-jp",
    gender: "female",
    cambId: 171038,
    cambName: "Hina Endo",
  },
  "B-chinese_female_camb": {
    name: "B-chinese_female_camb",
    speaker: "B",
    language: "zh",
    locale: "zh-cn",
    gender: "female",
    cambId: 171147,
    cambName: "Yan Yang",
  },
}

const DEFAULT_VOICE: Record<"A" | "B", string> = {
  A: "A-japanese_male_camb",
  B: "B-chinese_male_camb",
}

/**
 * Resolve the voice for a speaker.
 *
 * `CAMB_VOICE_A` / `CAMB_VOICE_B` accept either a name from NAMED_VOICES or a
 * raw numeric Camb id, so a voice from the wider catalogue can be tried without
 * a code change. A numeric id keeps the speaker's language, since the language
 * is a property of the speaker rather than of the override.
 */
export function resolveVoice(speaker: "A" | "B"): NamedVoice {
  const fallback = NAMED_VOICES[DEFAULT_VOICE[speaker]]
  const override = process.env[`CAMB_VOICE_${speaker}`]?.trim()
  if (!override) return fallback

  const named = NAMED_VOICES[override]
  if (named) {
    if (named.speaker !== speaker) {
      console.warn(
        `[voices] ${override} is a speaker-${named.speaker} voice but was set for speaker ${speaker}; using it anyway`
      )
    }
    return named
  }

  if (/^\d+$/.test(override)) {
    return {
      ...fallback,
      name: `${speaker}-custom_camb_${override}`,
      cambId: Number(override),
      cambName: `custom (${override})`,
    }
  }

  console.warn(
    `[voices] unknown CAMB_VOICE_${speaker}="${override}"; falling back to ${fallback.name}`
  )
  return fallback
}

export function listVoiceNames(): string[] {
  return Object.keys(NAMED_VOICES)
}
