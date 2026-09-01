/**
 * Podcast voice synthesis.
 *
 * Two providers, chosen by `TTS_PROVIDER` (or auto-detected from whichever key
 * is present). Both return raw audio bytes to the client, which plays them via
 * a Blob URL — see `lib/tts.ts`.
 *
 *   elevenlabs — multilingual, ~1s, MP3
 *   camb       — Japanese-native voices, ~5s warm / much slower cold, WAV
 *
 * See docs/SETUP_AND_RUNBOOK.md §8.
 */

import { resolveVoice, voiceByName } from "@/lib/voices"

type Speaker = "A" | "B"
type Lang = "ja" | "zh"

const ELEVENLABS_VOICES: Record<Speaker, string> = {
  A: process.env.ELEVENLABS_VOICE_KENJI ?? "pNInz6obpgDQGcFmaJgB", // Adam — Japanese
  B: process.env.ELEVENLABS_VOICE_WEI ?? "VR6AewLTigWG4xSOukaG", // Arnold — Chinese
}

function selectedProvider(): "elevenlabs" | "camb" | null {
  const explicit = process.env.TTS_PROVIDER?.toLowerCase()
  if (explicit === "camb") return process.env.CAMB_API_KEY ? "camb" : null
  if (explicit === "elevenlabs") {
    return process.env.ELEVENLABS_API_KEY ? "elevenlabs" : null
  }
  // Unset: prefer ElevenLabs for latency, fall back to whatever key exists.
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs"
  if (process.env.CAMB_API_KEY) return "camb"
  return null
}

async function synthElevenLabs(text: string, speaker: Speaker) {
  const voiceId = ELEVENLABS_VOICES[speaker]
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
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
    }
  )
  return { res, contentType: "audio/mpeg" }
}

async function synthCamb(text: string, speaker: Speaker, voiceName?: string) {
  // An explicitly requested voice wins; otherwise the speaker's default. Either
  // way the voice carries its own locale, since Camb voices are
  // language-specific and cannot take the caller's detected language.
  const voice = voiceByName(voiceName) ?? resolveVoice(speaker)

  const res = await fetch("https://client.camb.ai/apis/tts-stream", {
    method: "POST",
    headers: {
      "x-api-key": process.env.CAMB_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voice.cambId,
      language: voice.locale,
      speech_model: "mars-8.1-flash-beta",
      output_configuration: { format: "wav" },
    }),
  })
  return { res, contentType: "audio/wav", voiceName: voice.name }
}

export async function POST(request: Request) {
  const { text, speaker, lang, voice } = (await request.json()) as {
    text: string
    speaker: Speaker
    lang?: Lang // detected on client from actual text content
    voice?: string // optional registered voice name, e.g. A-japanese_female_camb
  }

  if (!text?.trim()) return Response.json({ error: "No text" }, { status: 400 })

  const provider = selectedProvider()
  if (!provider) {
    return Response.json(
      { error: "No TTS provider configured" },
      { status: 503 }
    )
  }

  // If Wei slipped into Japanese, use Kenji's voice so it sounds natural.
  const effectiveSpeaker: Speaker = lang === "ja" ? "A" : speaker

  // Camb rejects text outside 3–3000 characters with a validation error rather
  // than audio, so short interjections ("はい。") would fail mid-podcast.
  const payload =
    provider === "camb" && text.trim().length < 3
      ? `${text.trim()}。`
      : text.trim().slice(0, 3000)

  try {
    const { res, contentType, voiceName } =
      provider === "camb"
        ? await synthCamb(payload, effectiveSpeaker, voice)
        : { ...(await synthElevenLabs(payload, effectiveSpeaker)), voiceName: undefined }

    if (!res.ok) {
      const err = await res.text()
      console.error(`[podcast/tts] ${provider} ${res.status}:`, err.slice(0, 300))
      return Response.json({ error: err.slice(0, 300), provider }, { status: 502 })
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-TTS-Provider": provider,
        ...(voiceName ? { "X-TTS-Voice": voiceName } : {}),
      },
    })
  } catch (err) {
    console.error(`[podcast/tts] ${provider} request failed:`, err)
    return Response.json({ error: "TTS request failed", provider }, { status: 502 })
  }
}
