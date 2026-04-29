// GET /api/podcast/tts/ping — test ElevenLabs key validity
export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ ok: false, reason: "ELEVENLABS_API_KEY not set in .env.local" })

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  })

  if (!res.ok) {
    return Response.json({
      ok: false,
      status: res.status,
      reason: res.status === 401
        ? "Key is invalid or revoked — regenerate at elevenlabs.io → Profile → API Keys"
        : `ElevenLabs returned ${res.status}`,
    })
  }

  const data = await res.json() as { voices: { voice_id: string; name: string }[] }
  return Response.json({
    ok: true,
    voiceCount: data.voices?.length ?? 0,
    sample: data.voices?.slice(0, 3).map(v => `${v.name} (${v.voice_id})`),
  })
}
