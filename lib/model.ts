import OpenAI from "openai"

/**
 * Shared chat-provider configuration for every AI route.
 *
 * Kept in one place because a provider decommissioning a model breaks all of
 * them at once: `llama-3.3-70b-versatile` was retired by Groq while the id was
 * duplicated across five route handlers, so every AI feature 404'd silently.
 *
 * Any OpenAI-compatible provider works — set `AI_BASE_URL`, `AI_API_KEY` and
 * `AI_MODEL` in `.env.local`. Defaults keep the existing Groq setup working, and
 * the older `GROQ_*` names are still honoured.
 *
 * See docs/SETUP_AND_RUNBOOK.md §8 for tested provider/model combinations.
 */
export const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1"

export const AI_API_KEY = process.env.AI_API_KEY ?? process.env.GROQ_API_KEY

export const CHAT_MODEL =
  process.env.AI_MODEL ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"

/** Kept as a named export for backwards compatibility with older imports. */
export const GROQ_BASE_URL = AI_BASE_URL

type ReasoningEffort = "low" | "medium" | "high"

/**
 * Reasoning models spend tokens thinking before emitting any content, and that
 * thinking counts against `max_tokens` — a budget sized for the visible answer
 * alone comes back empty. But not every model accepts the parameter at all
 * (`groq/compound-mini` rejects the request outright), so it can be disabled
 * with `AI_REASONING_EFFORT=off`.
 */
const rawEffort = process.env.AI_REASONING_EFFORT ?? "low"

export const REASONING_EFFORT: ReasoningEffort | null =
  rawEffort === "off" || rawEffort === ""
    ? null
    : (rawEffort as ReasoningEffort)

/** Reasoning headroom added on top of whatever the visible response needs. */
export const REASONING_HEADROOM = REASONING_EFFORT ? 1500 : 0

export function tokenBudget(visibleTokens: number): number {
  return visibleTokens + REASONING_HEADROOM
}

/**
 * Providers disagree on how to request a reasoning budget even though both
 * speak the OpenAI wire format otherwise:
 *   - Groq/OpenAI:  { reasoning_effort: "low" }
 *   - OpenRouter:   { reasoning: { effort: "low" } }  — reasoning_effort is
 *     simply not read, so a model that reasons by default (stealth/ox-alpha)
 *     would spend the whole token budget thinking and return nothing.
 * Detected from AI_BASE_URL so a provider swap stays a single env change.
 */
const IS_OPENROUTER = AI_BASE_URL.includes("openrouter.ai")

function reasoningParam(): Record<string, unknown> {
  if (!REASONING_EFFORT) return {}
  return IS_OPENROUTER
    ? { reasoning: { effort: REASONING_EFFORT } }
    : { reasoning_effort: REASONING_EFFORT }
}

/**
 * Model parameters shared by every call site. Spread this instead of setting
 * `model`/`max_tokens`/reasoning fields by hand, so a provider swap needs no
 * route changes.
 */
export function chatParams(visibleTokens: number) {
  return {
    model: CHAT_MODEL,
    max_tokens: tokenBudget(visibleTokens),
    ...reasoningParam(),
  }
}

/**
 * The SDK throws on a missing key, which turned a missing env var into a *build*
 * failure: Next evaluates route modules when collecting page data, so a client
 * built at module scope crashed `next build` in CI with "Missing credentials".
 *
 * A placeholder defers that to request time, where it surfaces as a 401 and
 * friendlyAIError() explains it. Construct clients inside handlers anyway —
 * this only stops a mistake from breaking the build.
 */
export function createAIClient(): OpenAI {
  return new OpenAI({
    apiKey: AI_API_KEY ?? "missing-api-key",
    baseURL: AI_BASE_URL,
  })
}

/**
 * Turn a provider error into something safe to show a learner mid-conversation.
 *
 * Raw SDK messages leaked straight into the dialogue as `[错误: 429 Provider
 * returned error]`, which reads like the character malfunctioning. Rate limits
 * are routine on free tiers, so they get their own wording and are logged
 * rather than surfaced verbatim.
 */
export function friendlyAIError(err: unknown, context: string): string {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: number }).status
      : undefined
  const raw = err instanceof Error ? err.message : String(err)

  console.error(`[${context}] provider error (status=${status ?? "?"}):`, raw)

  if (status === 429) {
    return "（AI 服务达到频率限制，请稍等几秒再试）"
  }
  if (status === 401 || status === 403) {
    return "（AI 密钥无效，请检查 .env.local 中的 AI_API_KEY）"
  }
  if (status === 404) {
    return `（模型 ${CHAT_MODEL} 不可用，可能已下线；见 runbook §8）`
  }
  if (status && status >= 500) {
    return "（AI 服务暂时不可用，请稍后再试）"
  }
  return "（AI 请求失败，请重试）"
}
