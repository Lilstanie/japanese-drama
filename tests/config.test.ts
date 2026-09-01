import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"

/**
 * lib/model.ts and lib/voices.ts read process.env at module load, so each case
 * sets the environment and then imports a fresh copy via a cache-busting query.
 */
let n = 0
async function freshModel(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return import(`@/lib/model?case=${n++}`)
}
async function freshVoices(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return import(`@/lib/voices?case=${n++}`)
}

const AI_KEYS = [
  "AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_REASONING_EFFORT",
  "GROQ_API_KEY", "GROQ_MODEL", "CAMB_VOICE_A", "CAMB_VOICE_B",
]
let saved: Record<string, string | undefined> = {}
beforeEach(() => { saved = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]])) })
afterEach(() => {
  for (const k of AI_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const clear = Object.fromEntries(AI_KEYS.map((k) => [k, undefined]))

describe("provider config", () => {
  test("defaults to Groq", async () => {
    const m = await freshModel({ ...clear })
    assert.match(m.AI_BASE_URL, /api\.groq\.com/)
    assert.equal(m.CHAT_MODEL, "openai/gpt-oss-120b")
  })

  test("GROQ_MODEL still works as a legacy alias", async () => {
    const m = await freshModel({ ...clear, GROQ_MODEL: "legacy-model" })
    assert.equal(m.CHAT_MODEL, "legacy-model")
  })

  test("AI_MODEL wins over the legacy name", async () => {
    const m = await freshModel({ ...clear, GROQ_MODEL: "old", AI_MODEL: "new" })
    assert.equal(m.CHAT_MODEL, "new")
  })

  test("AI_API_KEY falls back to GROQ_API_KEY", async () => {
    const m = await freshModel({ ...clear, GROQ_API_KEY: "gsk-test" })
    assert.equal(m.AI_API_KEY, "gsk-test")
  })
})

describe("reasoning parameter shape differs by provider", () => {
  test("Groq gets reasoning_effort", async () => {
    const m = await freshModel({ ...clear })
    const p = m.chatParams(512) as Record<string, unknown>
    assert.equal(p.reasoning_effort, "low")
    assert.ok(!("reasoning" in p))
  })

  test("OpenRouter gets the nested reasoning map", async () => {
    // Regression: OpenRouter ignores reasoning_effort entirely, so a reasoning
    // model would spend its whole budget thinking and return nothing.
    const m = await freshModel({ ...clear, AI_BASE_URL: "https://openrouter.ai/api/v1" })
    const p = m.chatParams(512) as Record<string, unknown>
    assert.deepEqual(p.reasoning, { effort: "low" })
    assert.ok(!("reasoning_effort" in p))
  })

  test("can be disabled for models that reject the parameter", async () => {
    // groq/compound-mini 400s if reasoning_effort is present at all.
    const m = await freshModel({ ...clear, AI_REASONING_EFFORT: "off" })
    const p = m.chatParams(512) as Record<string, unknown>
    assert.ok(!("reasoning_effort" in p))
    assert.ok(!("reasoning" in p))
    assert.equal(p.max_tokens, 512, "no reasoning means no headroom needed")
  })

  test("budget leaves room for reasoning tokens", async () => {
    // A budget sized for the visible answer alone comes back empty.
    const m = await freshModel({ ...clear })
    assert.ok(m.tokenBudget(512) > 512)
  })
})

describe("friendly provider errors", () => {
  test("a rate limit does not leak the raw SDK message into the dialogue", async () => {
    const m = await freshModel({ ...clear })
    const msg = m.friendlyAIError(Object.assign(new Error("429 Provider returned error"), { status: 429 }), "test")
    assert.ok(!msg.includes("429"), `raw status leaked: ${msg}`)
    assert.match(msg, /频率限制/)
  })

  test("a retired model names itself so it can be swapped", async () => {
    const m = await freshModel({ ...clear, AI_MODEL: "retired-model" })
    const msg = m.friendlyAIError(Object.assign(new Error("404"), { status: 404 }), "test")
    assert.match(msg, /retired-model/)
  })

  test("auth failures point at the key", async () => {
    const m = await freshModel({ ...clear })
    assert.match(m.friendlyAIError(Object.assign(new Error("401"), { status: 401 }), "t"), /AI_API_KEY/)
  })

  test("an unknown error still returns something showable", async () => {
    const m = await freshModel({ ...clear })
    const msg = m.friendlyAIError(new Error("socket hang up"), "test")
    assert.ok(msg.length > 0)
    assert.ok(!msg.includes("socket hang up"))
  })
})

describe("podcast voice resolution", () => {
  test("speakers default to their own language", async () => {
    const v = await freshVoices({ ...clear })
    const a = v.resolveVoice("A")
    const b = v.resolveVoice("B")
    assert.equal(a.locale, "ja-jp")
    assert.equal(b.locale, "zh-cn")
    assert.equal(a.name, "A-japanese_male_camb")
    assert.equal(b.name, "B-chinese_male_camb")
  })

  test("a registered name selects that voice", async () => {
    const v = await freshVoices({ ...clear, CAMB_VOICE_A: "A-japanese_female_camb" })
    const a = v.resolveVoice("A")
    assert.equal(a.gender, "female")
    assert.equal(a.cambId, 171038)
    assert.equal(a.locale, "ja-jp", "override must not change the speaker's language")
  })

  test("a raw numeric id is accepted but keeps the speaker's language", async () => {
    const v = await freshVoices({ ...clear, CAMB_VOICE_B: "999999" })
    const b = v.resolveVoice("B")
    assert.equal(b.cambId, 999999)
    assert.equal(b.locale, "zh-cn")
  })

  test("an unknown name falls back instead of breaking synthesis", async () => {
    const v = await freshVoices({ ...clear, CAMB_VOICE_A: "does-not-exist" })
    assert.equal(v.resolveVoice("A").name, "A-japanese_male_camb")
  })

  test("a name requested by the client resolves to that voice", async () => {
    // The scene UI asks for a specific voice so the character and the learner
    // do not sound identical — both are Japanese, so speaker alone cannot tell
    // them apart.
    const v = await freshVoices({ ...clear })
    const char = v.voiceByName("A-japanese_female_camb")
    const user = v.voiceByName("A-japanese_male_camb")
    assert.equal(char?.gender, "female")
    assert.equal(user?.gender, "male")
    assert.equal(char?.locale, "ja-jp")
    assert.equal(user?.locale, "ja-jp")
    assert.notEqual(char?.cambId, user?.cambId)
  })

  test("an unknown requested name returns null so the caller can fall back", async () => {
    const v = await freshVoices({ ...clear })
    assert.equal(v.voiceByName("bogus-name"), null)
    assert.equal(v.voiceByName(undefined), null)
  })

  test("voicesForLanguage offers a real choice per language", async () => {
    const v = await freshVoices({ ...clear })
    assert.ok(v.voicesForLanguage("ja").length >= 2)
    assert.ok(v.voicesForLanguage("zh").length >= 2)
    assert.ok(v.voicesForLanguage("ja").every((x: { locale: string }) => x.locale === "ja-jp"))
  })

  test("every registered voice has a locale matching its speaker", async () => {
    const v = await freshVoices({ ...clear })
    for (const name of v.listVoiceNames()) {
      const voice = v.NAMED_VOICES[name]
      const expected = voice.speaker === "A" ? "ja-jp" : "zh-cn"
      assert.equal(voice.locale, expected, `${name} has the wrong locale`)
    }
  })
})
