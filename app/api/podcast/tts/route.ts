// Default premade ElevenLabs voices — swap via env vars from elevenlabs.io/voice-lab
const VOICE_IDS = {
  A: process.env.ELEVENLABS_VOICE_KENJI ?? "pNInz6obpgDQGcFmaJgB", // Adam — Japanese
  B: process.env.ELEVENLABS_VOICE_WEI   ?? "VR6AewLTigWG4xSOukaG", // Arnold — Chinese
}

export async function POST(request: Request) {
  const { text, speaker, lang } = (await request.json()) as {
    text: string
    speaker: "A" | "B"
    lang?: "ja" | "zh"   // detected on client from actual text content
  }

  if (!text?.trim()) return Response.json({ error: "No text" }, { status: 400 })

  // If Wei slipped into Japanese, use Kenji's voice so it sounds natural
  const effectiveSpeaker = lang === "ja" ? "A" : speaker
  const voiceId = VOICE_IDS[effectiveSpeaker]

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[podcast/tts] ElevenLabs ${res.status}:`, err)
    return Response.json({ error: err }, { status: 502 })
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  })
}
