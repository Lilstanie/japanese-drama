import { initBotId } from "botid/client/core"

/**
 * Vercel BotID — client instrumentation.
 *
 * BotID works in two halves: this runs in the browser and silently attaches a
 * proof-of-humanity signal to requests aimed at the protected paths, and each
 * route calls checkBotId() on the server to read the verdict. Listing a path
 * here is what makes its server-side check meaningful.
 *
 * Only the money-spending endpoints are protected — the ones that call the LLM
 * or TTS providers with our server-side keys. (BotID is a no-op in local dev;
 * it enforces once deployed on Vercel.)
 */
initBotId({
  protect: [
    { path: "/api/chat", method: "POST" },
    { path: "/api/coach", method: "POST" },
    { path: "/api/podcast/turn", method: "POST" },
    { path: "/api/podcast/tts", method: "POST" },
    { path: "/api/rag/generate", method: "POST" },
    { path: "/api/katakana/gloss", method: "POST" },
  ],
})
