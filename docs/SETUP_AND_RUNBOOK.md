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

- `GROQ_MODEL`  
  Overrides the chat model id. Defaults to `openai/gpt-oss-120b` (see §7).
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

### D) Every AI feature returns an error at once

Almost always a decommissioned model, not a broken key. Providers retire model
ids on their own schedule, and the id is shared by every route via
`lib/model.ts`, so they all fail together with a 404
`model_not_found`.

Check what the key can actually reach:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id'
```

Then set `GROQ_MODEL` in `.env.local` to a listed chat model, or update the
default in `lib/model.ts`.

### E) An AI route returns empty output

Current Groq chat models are reasoning models: they spend tokens thinking before
emitting any content, and that thinking counts against `max_tokens`. A budget
sized for the visible answer alone returns an empty completion (and, in JSON
mode, a `json_validate_failed` error with an empty `failed_generation`).

Routes call `tokenBudget(n)` from `lib/model.ts`, which adds reasoning headroom
on top of the visible-token estimate. Raise `REASONING_HEADROOM` there if a new
model needs more.

### F) Katakana shows no English source word

- Confirm the **ABC** toggle in the header is on.
- Terms in the `NON_LOANWORDS` blocklist are never annotated by design
  (onomatopoeia such as ドキドキ, native words such as ヤバイ).
- For a term that should be glossed, check the endpoint directly:

  ```bash
  curl -s -X POST http://localhost:3000/api/katakana/gloss \
    -H 'Content-Type: application/json' \
    -d '{"terms":["ジェットコースター"]}' | jq
  ```

  `"source":"partial"` means the model call failed — see §D and §E. A `null`
  gloss means the model judged it not a loanword.
- Client-side glosses are cached in `localStorage` under
  `jd:v1:katakana:glosses`; clear that key to force re-lookup.

### G) New scenario not showing on home page

- Ensure `EXTRA_SCENARIOS_JSON` is valid JSON array.
- Confirm scenario id is not in hidden list in `lib/scenarios.ts`.

## 6) Suggested Next Hardening

- Add server-side env validation on startup.
- Add API rate limiting.
- Add a startup check that `CHAT_MODEL` is present in the provider's model list,
  so a decommissioning surfaces at boot instead of on first user message.
- Add tests for:
  - scene chat stream
  - coach direct question (`@教练`)
  - podcast turn generation
  - kana romaji validation
  - katakana run segmentation (full-cover vs greedy)

## 7) Model Configuration

All Groq-backed routes read their model from `lib/model.ts`:

- `CHAT_MODEL` — `GROQ_MODEL` env override, else `openai/gpt-oss-120b`
- `REASONING_EFFORT` — `"low"`, keeps reasoning-token spend down
- `tokenBudget(n)` — visible tokens plus `REASONING_HEADROOM`

It is centralised deliberately: the previous id `llama-3.3-70b-versatile` was
retired by Groq while duplicated across five route handlers, which broke chat,
coach, podcast and RAG generation simultaneously and silently.
