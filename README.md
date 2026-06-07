# Japanese Drama (日本語ドラマ)

Immersive Japanese learning app with:

- Scene-based roleplay chat with Japanese character AI
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

# Optional (podcast AI voice)
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_KENJI=optional_voice_id
ELEVENLABS_VOICE_WEI=optional_voice_id

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

## RAG Demo (interview)

See [`docs/RAG_DEMO.md`](docs/RAG_DEMO.md) for architecture, API contract, and how to extend to an Agent with tools.

## Project Docs

See `docs/SETUP_AND_RUNBOOK.md` for architecture, environment details, debugging checklist, and operations runbook.
