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

- `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL`  
  Point the app at any OpenAI-compatible provider (see §7). Defaults to Groq.
- `AI_REASONING_EFFORT`  
  `low` (default), `medium`, `high`, or `off` for models that reject the parameter.
- `GROQ_MODEL`  
  Legacy alias for `AI_MODEL`.
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

### F0) A katakana word is deliberately not annotated

Only 外来語 (loanwords) get a source word. These are correct with no annotation:

- **Kana-chart rows** — アイウエオ, カキクケコ … These are syllable sequences,
  not words. Blocklisted so they never reach the model.
- **Onomatopoeia** — ドキドキ, ワクワク
- **Native words written in katakana** — ヤバイ, カタカナ itself
- **Brand and place names** — ヨドバシカメラ

If a sentence is entirely made of these, nothing lights up. That is the feature
working, not failing. Compare against a known loanword (コンビニ, サンドイッチ)
to tell the difference quickly.

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

## 7) Model & Provider Configuration

Every AI route builds its client with `createAIClient()` and spreads
`chatParams(n)` from `lib/model.ts`. Nothing else names a provider, so switching
is env-only:

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | Any OpenAI-compatible endpoint |
| `AI_API_KEY` | falls back to `GROQ_API_KEY` | Provider key |
| `AI_MODEL` | `openai/gpt-oss-120b` | Model id (`GROQ_MODEL` also accepted) |
| `AI_REASONING_EFFORT` | `low` | `off` for models that reject the parameter |

Centralised deliberately: the previous id `llama-3.3-70b-versatile` was retired
by Groq while duplicated across five route handlers, which broke chat, coach,
podcast and RAG generation simultaneously and silently.

### Reasoning parameter differs by provider

Both speak the OpenAI wire format, but not for reasoning budget:

- Groq / OpenAI — `reasoning_effort: "low"`
- OpenRouter — `reasoning: { effort: "low" }`; it does **not** read
  `reasoning_effort`, so a model that reasons by default would spend the whole
  budget thinking and return nothing.

`chatParams()` picks the right shape from `AI_BASE_URL`. A new provider with a
third convention needs a branch there and nowhere else.

### Tested free options

Measured on this app's own workloads — Japanese roleplay with furigana, and the
JSON-mode katakana gloss.

| Model | Chat | Gloss (JSON) | Notes |
|-------|------|--------------|-------|
| `openai/gpt-oss-120b` (default) | good, ~0.9s | reliable | Best overall |
| `openai/gpt-oss-20b` | good, ~0.45s | **unreliable** | 2× faster, but garbles katakana keys and intermittently fails JSON mode |
| `qwen/qwen3.6-27b` | — | fails | `json_validate_failed` |
| `groq/compound-mini` | needs `AI_REASONING_EFFORT=off` | works | Rejects `reasoning_effort` |

`gpt-oss-20b` is reasonable for chat-only use, but keep the gloss route on a
stronger model — a weak model returning a garbled key leaves the term
unannotated (see §F).

### Other providers

Anything OpenAI-compatible works. OpenRouter, for example:

```bash
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-...
AI_MODEL=stealth/ox-alpha
```

Free-tier rosters churn, and OpenRouter's `stealth/*` ids are anonymised preview
models that get renamed or pulled without notice. Prefer changing `AI_MODEL`
over editing code so a swap stays a config change.

**Measured on OpenRouter free tier (`stealth/ox-alpha`):** of five rapid
sequential chat calls, one returned empty, two succeeded, and one hung past 60s;
sustained use returned `429`. Fine for trying a model, not for actually using
the app. Groq's `openai/gpt-oss-120b` handled the same five calls without error,
which is why it remains the default.

Provider errors no longer leak into the dialogue. `friendlyAIError()` maps
status codes to a readable note (rate limit, bad key, retired model) and logs
the raw error server-side.

## 8) Romaji Word Segmentation

`lib/romaji.ts` has to decide where words end, because Japanese is written
without spaces and unsegmented romaji is unreadable. Two shortcuts avoid needing
a morphological analyser:

- **Kanji boundaries come from the furigana markup.** The model annotates whole
  words, so 食べ物(たべもの) is one unit by construction — and the reading is
  what makes the kanji convertible at all.
- **Katakana runs** are already segmented by the loanword dictionary.

That leaves hiragana runs, split by a lexicon (`KANA_WORDS`, `PARTICLES`).
Rules worth knowing before editing it:

| Rule | Why |
|------|-----|
| Words match before particles | で is a particle but です/できる are words |
| Except directly after a content word, for は が を に へ | 今日はいい is 今日+は+いい, not 今日+はい+い |
| か ね よ な わ match only at the end of a run | か is a particle in しませんか, a syllable in かけて |
| One-kana readings absorb what follows | それ is a verb stem: 曲(ま)がって → magatte |
| …but stop at `OKURIGANA_STOP` | ください is its own word; いました is inflection |
| Unmatched kana stay in one chunk | An unfamiliar word beats stray syllables |

To improve coverage, add to `KANA_WORDS` — the same curation model as the
katakana dictionary. Add tests alongside; the suite is mutation-checked.

**TinySegmenter was evaluated and rejected**: it split ください into く+ださい and
すみません into すみませ+ん. kuromoji is accurate but ships a 40MB dictionary,
which is far too heavy for client-side use.

## 9) Voice / TTS Options

Provider is chosen by `TTS_PROVIDER`, or auto-detected from whichever key is
present (ElevenLabs preferred for latency). The client just plays whatever bytes
`/api/podcast/tts` returns, so providers differ only inside that route.

| Var | Purpose |
|-----|---------|
| `TTS_PROVIDER` | `elevenlabs` (default) or `camb` |
| `CAMB_API_KEY` | Camb AI key |
| `CAMB_VOICE_A` / `CAMB_VOICE_B` | Voice name from `lib/voices.ts`, or a raw numeric Camb id |

`GET /api/podcast/tts/ping` checks whichever provider is active and reports how
many voices the key can reach.

### Where the AI voice is reachable from the UI

| Page | Control | Voice |
|------|---------|-------|
| `/podcast` | ▶ play | Speaker A/B defaults (ja / zh) |
| `/scene/[id]` | 🔊 per message, and 🔊 自动 | Character = `A-japanese_female_camb`, learner = `A-japanese_male_camb` |

Scene lines are all Japanese, so the two sides cannot be told apart by speaker
the way the podcast's two languages can — the request names the voice explicitly
via the `voice` field on `POST /api/podcast/tts`. An unrecognised name falls back
to the speaker default rather than failing.

The **🎙 AI 语音 / 💻 浏览器语音** button in the scene header switches between the
provider voice and the browser's built-in speech synthesis; the browser voice
pickers only appear in browser mode, where they mean something.

### Named voices

Speaker A speaks Japanese, speaker B Chinese, and a Camb voice speaks only its
own language — so the two speakers must be paired with voices from different
catalogues. `lib/voices.ts` names those pairings
(`<speaker>-<language>_<gender>_<provider>`):

| Name | Camb voice | Language |
|------|-----------|----------|
| `A-japanese_male_camb` (default A) | Haruto Aoki (171037) | ja-jp |
| `A-japanese_female_camb` | Hina Endo (171038) | ja-jp |
| `B-chinese_male_camb` (default B) | Lei Sun (171145) | zh-cn |
| `B-chinese_female_camb` | Yan Yang (171147) | zh-cn |

Catalogue totals: **18 Japanese** voices (12 male / 6 female) and **37 Mandarin**
(29 / 8). `CAMB_VOICE_A` / `CAMB_VOICE_B` take a name from the table or a raw
numeric id to try any other voice without a code change; an unrecognised value
logs a warning and falls back to the default rather than failing the request.

`GET /api/podcast/tts/ping` reports the resolved voice for each speaker and
whether the key can actually reach it, and responses carry an `X-TTS-Voice`
header — so a wrong voice is visible immediately rather than as an
unexpected-sounding line mid-podcast.

### Camb AI (measured)

Verified working for both speakers: Japanese `ja-jp` and Mandarin `zh-cn`,
returning 48 kHz mono 16-bit WAV that decodes cleanly in-browser.

- **18 Japanese voices** (language code 88), male and female — genuinely
  native-sounding, unlike a multilingual voice speaking Japanese.
- **Latency 2–6s warm, ~86s on a cold start.** ElevenLabs is ~1s.
- **Text must be 3–3000 characters.** Below 3 the API returns a JSON validation
  error instead of audio, so the route pads very short lines (`はい` → `はい。`)
  and truncates at 3000.
- The WAV declares `0xFFFFFFFF` for its RIFF and data chunk sizes (streaming
  WAV, unknown length). Browsers decode it fine — no header repair needed.

**Latency caveat:** `PodcastPlayer` prefetches the next *text* line in parallel
with speaking, but the *audio* fetch happens inline in `speakLine`. With
ElevenLabs (~1s) that is barely noticeable; with Camb it becomes a 2–6s silence
before every line. Prefetching audio alongside the text would fix it, and is the
main thing standing between Camb and a smooth podcast.

### Other free options

Two dead ends worth recording: **LLM aggregators such as OpenRouter serve no TTS
at all**, and Groq's TTS models (`canopylabs/orpheus-*`) are English and Arabic
only — neither can voice this app's Japanese.

| Option | Key needed | Notes |
|--------|-----------|-------|
| Web Speech API | none | Built-in fallback; quality depends on installed OS voices |
| Microsoft Edge TTS | none | Neural voices incl. `ja-JP-NanamiNeural` / `ja-JP-KeitaNeural`, via the `msedge-tts` npm package. Unofficial protocol — best-effort |
| VOICEVOX | none | Japanese-only engine, self-hosted via Docker (`voicevox/voicevox_engine`); `POST /audio_query` then `POST /synthesis`. Commercial use allowed with credit. Needs a container, so not serverless-friendly |
