# Setup and Runbook

## 1) Architecture Overview

This app has three user-facing learning modes:

- Scene Roleplay (`/scene/[id]`)
  - Left panel: Japanese character dialog
  - Right panel: Chinese coach analysis
  - Input supports `@教练` direct coach questions
- Podcast (`/podcast`)
  - Alternating AI speakers (Kenji in Japanese, Wei in Chinese)
  - Transcript + playback controls + speed/volume
  - AI TTS (ElevenLabs) with browser speech fallback
- Kana Practice (`/practice`)
  - Hiragana/Katakana learning + romaji validation grid

Core data/types:

- `lib/types.ts`: `Scenario`, `Message`
- `lib/scenarios.ts`: built-in scenarios + env-injected extras
- `lib/podcast-topics.ts`: podcast topics
- `lib/kana.ts`: kana rows and entries

## 2) API Flow

### Scene Roleplay

1. User sends message from `SceneClient`.
2. `POST /api/chat` streams character response (Japanese).
3. UI appends character message.
4. `POST /api/coach` streams Chinese explanation/suggestions.

### Podcast

1. `PodcastPlayer` requests `POST /api/podcast/turn` for next line.
2. Line is appended to transcript.
3. `lib/tts.ts` attempts AI voice via `POST /api/podcast/tts`.
4. If AI TTS fails, falls back to Web Speech API.

## 3) Environment Variables

Required:

- `GROQ_API_KEY`  
  Used by `/api/chat`, `/api/coach`, `/api/podcast/turn`.

Optional:

- `ELEVENLABS_API_KEY`  
  Enables AI voice in podcast mode.
- `ELEVENLABS_VOICE_KENJI`  
  Override default Kenji voice id.
- `ELEVENLABS_VOICE_WEI`  
  Override default Wei voice id.
- `EXTRA_SCENARIOS_JSON`  
  JSON array of additional scenarios.
- `EXTRA_PROMPTS_JSON`  
  JSON object keyed by scenario id for extra chat prompt instructions.

Example:

```bash
GROQ_API_KEY=xxxx
ELEVENLABS_API_KEY=xxxx
ELEVENLABS_VOICE_KENJI=pNInz6obpgDQGcFmaJgB
ELEVENLABS_VOICE_WEI=VR6AewLTigWG4xSOukaG
EXTRA_SCENARIOS_JSON=[]
EXTRA_PROMPTS_JSON={}
```

## 4) Local Development

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run start
```

## 5) Runbook (Common Issues)

### A) Scene or coach does not reply

- Check `.env.local` has valid `GROQ_API_KEY`.
- Open browser devtools and inspect failed request to `/api/chat` or `/api/coach`.
- Verify API route returns stream text, not HTML error.

### B) Podcast speaks with robotic voice unexpectedly

- AI TTS fallback triggered.
- Verify `ELEVENLABS_API_KEY`.
- Test directly: `GET /api/podcast/tts/ping`.

### C) Podcast line generation stalls

- `PodcastPlayer` has timeout/retry for `/api/podcast/turn`, but long provider latency can still cause pauses.
- Check server logs for `HTTP`/provider errors.

### D) New scenario not showing on home page

- Ensure `EXTRA_SCENARIOS_JSON` is valid JSON array.
- Confirm scenario id is not in hidden list in `lib/scenarios.ts`.

## 6) Suggested Next Hardening

- Add server-side env validation on startup.
- Add API rate limiting.
- Add tests for:
  - scene chat stream
  - coach direct question (`@教练`)
  - podcast turn generation
  - kana romaji validation
