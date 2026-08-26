// GET /api/podcast/tts/ping — check whichever TTS provider is configured

import { resolveVoice } from "@/lib/voices"

async function pingElevenLabs(key: string) {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  })

  if (!res.ok) {
    return {
      ok: false,
      provider: "elevenlabs" as const,
      status: res.status,
      reason:
        res.status === 401
          ? "Key is invalid or revoked — regenerate at elevenlabs.io → Profile → API Keys"
          : `ElevenLabs returned ${res.status}`,
    }
  }

  const data = (await res.json()) as {
    voices: { voice_id: string; name: string }[]
  }
  return {
    ok: true,
    provider: "elevenlabs" as const,
    voiceCount: data.voices?.length ?? 0,
    sample: data.voices?.slice(0, 3).map((v) => `${v.name} (${v.voice_id})`),
  }
}

async function pingCamb(key: string) {
  const res = await fetch("https://client.camb.ai/apis/list-voices", {
    headers: { "x-api-key": key },
  })

  if (!res.ok) {
    return {
      ok: false,
      provider: "camb" as const,
      status: res.status,
      reason:
        res.status === 401
          ? "Key is invalid or revoked — regenerate at camb.ai → Studio → API"
          : `Camb AI returned ${res.status}`,
    }
  }

  const raw = (await res.json()) as unknown
  const voices = (
    Array.isArray(raw) ? raw : ((raw as { payload?: unknown[] })?.payload ?? [])
  ) as { id: number; voice_name: string; language: number }[]

  // 88 = Japanese, 139 = Mandarin. The podcast needs one of each: speaker A is
  // Japanese and speaker B Chinese, and a Camb voice speaks only its own language.
  const japanese = voices.filter((v) => v.language === 88)
  const chinese = voices.filter((v) => v.language === 139)

  // Report what the two speakers will actually use, so a bad override is
  // visible here rather than as a wrong-language voice mid-podcast.
  const a = resolveVoice("A")
  const b = resolveVoice("B")
  const reachable = (id: number) => voices.some((v) => v.id === id)

  return {
    ok: true,
    provider: "camb" as const,
    voiceCount: voices.length,
    available: { japanese: japanese.length, chinese: chinese.length },
    speakers: {
      A: { ...a, reachable: reachable(a.cambId) },
      B: { ...b, reachable: reachable(b.cambId) },
    },
  }
}

export async function GET() {
  const explicit = process.env.TTS_PROVIDER?.toLowerCase()
  const elevenKey = process.env.ELEVENLABS_API_KEY
  const cambKey = process.env.CAMB_API_KEY

  const provider =
    explicit === "camb" || (!explicit && !elevenKey && cambKey)
      ? "camb"
      : "elevenlabs"

  const key = provider === "camb" ? cambKey : elevenKey
  if (!key) {
    return Response.json({
      ok: false,
      provider,
      reason: `${provider === "camb" ? "CAMB_API_KEY" : "ELEVENLABS_API_KEY"} not set in .env.local`,
    })
  }

  try {
    return Response.json(
      provider === "camb" ? await pingCamb(key) : await pingElevenLabs(key)
    )
  } catch (err) {
    return Response.json({
      ok: false,
      provider,
      reason: err instanceof Error ? err.message : "Request failed",
    })
  }
}
