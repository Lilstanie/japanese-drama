# Japanese Drama (日本語ドラマ)

Immersive Japanese learning app with:

- Scene-based roleplay chat with Japanese character AI
- **Katakana loanword annotation** — the English (or German/French/...) source word rendered above katakana, like furigana for 外来語
- Chinese coach analysis/support panel
- Bilingual podcast auto-conversation mode with TTS
- Kana (hiragana/katakana) practice grid
- **RAG demo** — retrieval-augmented Q&A over a built-in Japanese-learning knowledge base

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Groq-compatible chat API via `openai` SDK
- Optional ElevenLabs TTS for podcast voice playback

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
GROQ_API_KEY=your_groq_key

# Optional — swap in any OpenAI-compatible provider/model
# (see docs/SETUP_AND_RUNBOOK.md §7)
AI_BASE_URL=https://api.groq.com/openai/v1
AI_API_KEY=your_key
AI_MODEL=openai/gpt-oss-120b

# Optional (podcast AI voice) — see docs/SETUP_AND_RUNBOOK.md §8
TTS_PROVIDER=elevenlabs           # or: camb
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_KENJI=optional_voice_id
ELEVENLABS_VOICE_WEI=optional_voice_id

# Camb AI — Japanese-native voices (slower than ElevenLabs)
CAMB_API_KEY=your_camb_key
CAMB_VOICE_A=A-japanese_male_camb
CAMB_VOICE_B=B-chinese_male_camb

# Optional scenario extensions
EXTRA_SCENARIOS_JSON=[]
EXTRA_PROMPTS_JSON={}
```

3. Run dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Routes

- `/` scene selector home
- `/scene/[id]` roleplay + coach split view
- `/podcast` bilingual podcast player
- `/practice` kana practice page
- `/rag` RAG pipeline demo (retrieve → generate with citations)
- `/api/chat` character streaming response
- `/api/coach` Chinese coach streaming response
- `/api/podcast/turn` generate next podcast line
- `/api/podcast/tts` ElevenLabs TTS proxy
- `/api/podcast/tts/ping` check ElevenLabs key validity
- `/api/rag/retrieve` TF-IDF chunk retrieval
- `/api/rag/generate` grounded answer streaming (Groq)
- `/api/rag/stats` corpus / index stats
- `/api/katakana/gloss` katakana loanword → source word lookup

## Katakana Annotation

Source words above katakana loanwords, as a second annotation layer alongside
furigana. See [`docs/KATAKANA_ANNOTATION.md`](docs/KATAKANA_ANNOTATION.md) for the
rendering approach, segmentation rules, and how to extend the dictionary.

## RAG Demo (interview)

See [`docs/RAG_DEMO.md`](docs/RAG_DEMO.md) for architecture, API contract, and how to extend to an Agent with tools.

## Project Docs

See `docs/SETUP_AND_RUNBOOK.md` for architecture, environment details, debugging checklist, and operations runbook.
