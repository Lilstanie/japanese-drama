/**
 * Named voices for every place the app speaks.
 *
 * Camb voices are language-locked — one voice cannot speak both Japanese and
 * Chinese — so a voice is chosen per *role*, and each role only ever offers
 * voices of its own language.
 *
 * Names follow `<role>-<language>_<gender>_<provider>` so a new provider or
 * gender slots in without renaming anything.
 *
 * The catalogue is deliberately curated rather than exhaustive: Camb offers 18
 * Japanese and 37 Mandarin voices, but a dropdown of 37 is not a choice, it is
 * a chore. Descriptions are Camb's own, condensed.
 */

export type VoiceLanguage = "ja" | "zh"
export type VoiceRole = "character" | "narrator" | "chinese"

export type NamedVoice = {
  /** Stable name used in config, storage and logs. */
  name: string
  language: VoiceLanguage
  /** Camb locale tag sent as the `language` field. */
  locale: string
  gender: "male" | "female"
  /** Camb numeric voice id. */
  cambId: number
  /** Camb's own label, for debugging and for the picker. */
  cambName: string
  /** Short description shown in the picker. */
  description: string
}

const JA = (
  gender: "male" | "female",
  cambId: number,
  cambName: string,
  description: string
): NamedVoice => ({
  name: `ja_${gender}_${cambId}`,
  language: "ja",
  locale: "ja-jp",
  gender,
  cambId,
  cambName,
  description,
})

const ZH = (
  gender: "male" | "female",
  cambId: number,
  cambName: string,
  description: string
): NamedVoice => ({
  name: `zh_${gender}_${cambId}`,
  language: "zh",
  locale: "zh-cn",
  gender,
  cambId,
  cambName,
  description,
})

const CATALOGUE: NamedVoice[] = [
  // ─── 日语 · 女声 ───────────────────────────────────────────────
  JA("female", 171038, "Hina Endo", "温柔、亲切 · 适合讲解"),
  JA("female", 171044, "Rin Nakamura", "轻柔、平静 · 语速平缓"),
  JA("female", 171035, "Aoi Sato", "温和、友好 · 适合叙事"),
  JA("female", 165299, "Yui Sato", "有礼、柔和 · 说话轻"),

  // ─── 日语 · 男声 ───────────────────────────────────────────────
  JA("male", 171040, "Kenta Hayashi", "低沉、冷静 · 适合教学"),
  JA("male", 165284, "Hiroshi Tanaka", "沉稳、清晰 · 有分寸"),
  JA("male", 171036, "Daiki Abe", "冷静、专业 · 适合讲解"),
  JA("male", 171049, "Yuto Abe", "朗読风 · 适合旁白"),
  JA("male", 171037, "Haruto Aoki", "元气、表现力强 · 偏戏剧"),

  // ─── 中文 · 女声 ───────────────────────────────────────────────
  ZH("female", 165328, "Li Na", "沉稳、专业 · 有分寸"),
  ZH("female", 171133, "Li Li", "专业、清晰"),
  ZH("female", 171129, "Lan Yang", "自然、口语化 · 像聊天"),
  ZH("female", 171134, "Mei Wang", "自然、放松"),

  // ─── 中文 · 男声 ───────────────────────────────────────────────
  ZH("male", 165329, "Chen Hao", "清晰、友好 · 有信息量"),
  ZH("male", 171128, "Bin Xu", "成熟、冷静、专业"),
  ZH("male", 171115, "Bo Li", "平静、温和 · 适合讲解"),
  ZH("male", 171145, "Lei Sun", "有活力、自信"),
]

export const NAMED_VOICES: Record<string, NamedVoice> = Object.fromEntries(
  CATALOGUE.map((v) => [v.name, v])
)

/**
 * Roles, and which voice each uses by default.
 *
 * `narrator` covers the learner's own lines in a scene and the Japanese speaker
 * in the podcast — both are "the app reading Japanese at you", so one choice
 * serves both and the picker stays short.
 */
export const ROLES: Record<
  VoiceRole,
  { label: string; hint: string; language: VoiceLanguage; fallback: string }
> = {
  character: {
    label: "角色声音",
    hint: "场景里和你对话的人",
    language: "ja",
    fallback: "ja_female_171038",
  },
  narrator: {
    label: "日语朗读",
    hint: "你自己的消息 · 播客日语",
    language: "ja",
    fallback: "ja_male_171040",
  },
  chinese: {
    label: "中文声音",
    hint: "播客里的中文说话人",
    language: "zh",
    fallback: "zh_male_171145",
  },
}

/** Voices a given role may use — always its own language. */
export function voicesForRole(role: VoiceRole): NamedVoice[] {
  return CATALOGUE.filter((v) => v.language === ROLES[role].language)
}

/** Speaker A is Japanese, speaker B Chinese — the podcast's fixed pairing. */
export function roleForSpeaker(speaker: "A" | "B"): VoiceRole {
  return speaker === "A" ? "narrator" : "chinese"
}

/**
 * Look up a voice by name. Returns null for an unknown name rather than
 * throwing, so a stale value stored in a browser cannot break synthesis.
 */
export function voiceByName(name: string | undefined): NamedVoice | null {
  if (!name) return null
  return NAMED_VOICES[name] ?? null
}

/**
 * Server-side default for a speaker, used when the client sends no voice.
 *
 * `CAMB_VOICE_A` / `CAMB_VOICE_B` accept a registered name or a raw numeric
 * Camb id, so a voice outside the curated list can be tried without a code
 * change. A numeric id keeps the speaker's language, which belongs to the role.
 */
export function resolveVoice(speaker: "A" | "B"): NamedVoice {
  const role = roleForSpeaker(speaker)
  const fallback = NAMED_VOICES[ROLES[role].fallback]
  const override = process.env[`CAMB_VOICE_${speaker}`]?.trim()
  if (!override) return fallback

  const named = NAMED_VOICES[override]
  if (named) {
    if (named.language !== fallback.language) {
      console.warn(
        `[voices] CAMB_VOICE_${speaker}="${override}" is ${named.language}, but speaker ${speaker} needs ${fallback.language}; using it anyway`
      )
    }
    return named
  }

  if (/^\d+$/.test(override)) {
    return {
      ...fallback,
      name: `custom_${override}`,
      cambId: Number(override),
      cambName: `custom (${override})`,
      description: "自定义",
    }
  }

  console.warn(
    `[voices] unknown CAMB_VOICE_${speaker}="${override}"; falling back to ${fallback.name}`
  )
  return fallback
}

export function listVoiceNames(): string[] {
  return CATALOGUE.map((v) => v.name)
}

/** Voices available for a given language. */
export function voicesForLanguage(language: VoiceLanguage): NamedVoice[] {
  return CATALOGUE.filter((v) => v.language === language)
}
