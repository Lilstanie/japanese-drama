import { AI_API_KEY, AI_BASE_URL, CHAT_MODEL, createAIClient } from "@/lib/model"
import { resolveVoice } from "@/lib/voices"

/**
 * Health check for the things that break silently.
 *
 * Written after `llama-3.3-70b-versatile` was retired by Groq: every AI route
 * started returning 404 and nothing surfaced it, because a failed chat request
 * just looks like the character not answering. The checks here are the ones a
 * person would never think to run daily.
 *
 * Deliberately reports names and booleans only — never key material — since
 * this endpoint is public.
 */

export const dynamic = "force-dynamic"

type Check = { ok: boolean; detail: string }

/** The decommissioning check: is the configured model still offered? */
async function checkChatModel(): Promise<Check> {
  if (!AI_API_KEY) return { ok: false, detail: "AI_API_KEY is not set" }

  try {
    const client = createAIClient()
    const list = await client.models.list()
    const ids = list.data.map((m) => m.id)

    if (!ids.includes(CHAT_MODEL)) {
      return {
        ok: false,
        detail: `model "${CHAT_MODEL}" is no longer offered by ${AI_BASE_URL}; ${ids.length} models available`,
      }
    }
    return { ok: true, detail: `${CHAT_MODEL} available` }
  } catch (err) {
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: number }).status
        : undefined
    return {
      ok: false,
      detail: `provider error${status ? ` (${status})` : ""}${status === 401 ? " — key invalid or revoked" : ""}`,
    }
  }
}

/** Is the TTS key still valid, and can it reach both speakers' voices? */
async function checkTts(): Promise<Check> {
  const provider = process.env.TTS_PROVIDER?.toLowerCase()
  const cambKey = process.env.CAMB_API_KEY
  const elevenKey = process.env.ELEVENLABS_API_KEY

  if (!cambKey && !elevenKey) {
    return { ok: true, detail: "no TTS key set — podcast falls back to browser voices" }
  }

  if (provider === "camb" || (!provider && !elevenKey && cambKey)) {
    try {
      const res = await fetch("https://client.camb.ai/apis/list-voices", {
        headers: { "x-api-key": cambKey! },
      })
      if (!res.ok) {
        return {
          ok: false,
          detail: `camb returned ${res.status}${res.status === 401 ? " — key invalid or revoked" : ""}`,
        }
      }

      const raw = (await res.json()) as unknown
      const voices = (
        Array.isArray(raw) ? raw : ((raw as { payload?: unknown[] })?.payload ?? [])
      ) as { id: number }[]
      const ids = new Set(voices.map((v) => v.id))

      // A voice that vanished from the catalogue would fail only mid-episode.
      const missing = (["A", "B"] as const)
        .map((s) => resolveVoice(s))
        .filter((v) => !ids.has(v.cambId))
      if (missing.length) {
        return {
          ok: false,
          detail: `voice(s) unreachable: ${missing.map((v) => `${v.cambName} (${v.cambId})`).join(", ")}`,
        }
      }
      return { ok: true, detail: `camb reachable, ${voices.length} voices` }
    } catch {
      return { ok: false, detail: "camb request failed" }
    }
  }

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": elevenKey! },
    })
    return res.ok
      ? { ok: true, detail: "elevenlabs reachable" }
      : { ok: false, detail: `elevenlabs returned ${res.status}` }
  } catch {
    return { ok: false, detail: "elevenlabs request failed" }
  }
}

export async function GET() {
  // Run both checks together — a slow provider should not serialise the other.
  const [chatModel, tts] = await Promise.all([checkChatModel(), checkTts()])

  const checks = { chatModel, tts }
  const ok = Object.values(checks).every((c) => c.ok)

  if (!ok) {
    console.error("[health] unhealthy:", JSON.stringify(checks))
  }

  // 503 so `curl --fail` and uptime checks treat this as down without parsing.
  return Response.json(
    { ok, checkedAt: new Date().toISOString(), checks },
    { status: ok ? 200 : 503 }
  )
}
