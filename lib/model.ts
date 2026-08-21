/**
 * Shared chat-model configuration for every Groq-backed route.
 *
 * Kept in one place because a provider decommissioning a model breaks all of
 * them at once: `llama-3.3-70b-versatile` was retired by Groq and the id was
 * duplicated across five route handlers, so every AI feature 404'd silently.
 *
 * Override with GROQ_MODEL in `.env.local` to try a different model without a
 * code change — `curl https://api.groq.com/openai/v1/models` lists what your
 * key can reach.
 */
export const CHAT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"

/**
 * Current Groq chat models are reasoning models: they spend tokens thinking
 * before emitting any content, and that thinking counts against `max_tokens`.
 * A budget sized for the visible answer alone gets consumed by reasoning and
 * returns an empty completion, so keep these floors when calling them.
 */
export const REASONING_EFFORT = "low" as const

/** Reasoning headroom on top of whatever the visible response needs. */
export const REASONING_HEADROOM = 1500

export function tokenBudget(visibleTokens: number): number {
  return visibleTokens + REASONING_HEADROOM
}

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
