/**
 * Per-IP rate limiting for the routes that spend money (LLM + TTS calls).
 *
 * The routes hold server-side provider keys, so without a cap anyone who finds
 * the deployment URL can call them in a loop and drain the account. This puts a
 * fixed window ("N requests per IP per windowSec") in front of each one.
 *
 * Two backends, chosen automatically so protection works before any service is
 * provisioned:
 *
 *   - **Upstash Redis** when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *     are set — a shared counter across every serverless instance, so the limit
 *     is truly global. Uses the REST API over fetch, so there is no SDK to
 *     install; provisioning Upstash (which sets those env vars) is all it takes
 *     to upgrade.
 *   - **In-memory** otherwise — a per-instance counter. Real protection locally
 *     and a meaningful speed bump in production (Fluid Compute reuses
 *     instances), but not global. The spend caps set in each provider's own
 *     dashboard remain the guaranteed backstop.
 *
 * The limiter fails **open**: if its own backend errors, the request is allowed
 * rather than the whole app going down with the limiter.
 */

type RateResult = { ok: boolean; limit: number; remaining: number; retryAfter: number }

/** Best-effort client IP from the proxy headers Vercel sets. */
function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

// ---- in-memory backend -----------------------------------------------------

const memory = new Map<string, { count: number; resetAt: number }>()

function memoryLimit(key: string, limit: number, windowMs: number, now: number): RateResult {
  const entry = memory.get(key)
  if (!entry || now >= entry.resetAt) {
    memory.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistically drop expired keys so the map cannot grow unbounded.
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (now >= v.resetAt) memory.delete(k)
    }
    return { ok: true, limit, remaining: limit - 1, retryAfter: 0 }
  }
  entry.count++
  const ok = entry.count <= limit
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfter: ok ? 0 : Math.ceil((entry.resetAt - now) / 1000),
  }
}

// ---- Upstash Redis backend (REST, no SDK) ----------------------------------

async function upstashLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  // INCR the window's counter and (re)set its TTL in one round trip. The key is
  // bucketed by window so a fresh window starts at zero on its own.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSec],
    ]),
    // Never let a slow limiter backend stall the request for long.
    signal: AbortSignal.timeout(1500),
  })
  if (!res.ok) throw new Error(`upstash ${res.status}`)

  const data = (await res.json()) as Array<{ result?: number; error?: string }>
  const count = data?.[0]?.result
  if (typeof count !== "number") throw new Error("upstash malformed response")

  const ok = count <= limit
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfter: ok ? 0 : windowSec,
  }
}

// ---- public API ------------------------------------------------------------

export type RateLimitOptions = {
  /** Namespaces the counter, e.g. "chat" — keep distinct per route. */
  name: string
  /** Max requests per IP within the window. */
  limit: number
  /** Window length in seconds. */
  windowSec: number
}

/**
 * Enforce a per-IP limit. Returns a 429 `Response` to return from the route
 * when the caller is over the limit, or `null` to let the request proceed.
 */
export async function enforceRateLimit(
  request: Request,
  opts: RateLimitOptions,
): Promise<Response | null> {
  const now = Date.now()
  const ip = clientIp(request)
  const bucket = Math.floor(now / 1000 / opts.windowSec)
  const key = `rl:${opts.name}:${ip}:${bucket}`

  let result: RateResult
  try {
    result =
      (await upstashLimit(key, opts.limit, opts.windowSec)) ??
      memoryLimit(key, opts.limit, opts.windowSec * 1000, now)
  } catch (err) {
    // Fail open: a limiter outage must not take the route down with it.
    console.warn(`[rate-limit] ${opts.name} backend error, allowing request:`, err)
    return null
  }

  if (result.ok) return null

  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  )
}

/**
 * Reject automated (bot) traffic via Vercel BotID.
 *
 * The client half (instrumentation-client.ts) attaches a proof signal to the
 * protected paths; this reads BotID's verdict on the server and returns a 403
 * for bots. Pairs with the rate limiter: the limiter caps volume per IP, BotID
 * catches scripted clients that stay under that cap.
 *
 * Fails **open** — a BotID outage must not lock out real users — and is inert
 * in local dev, enforcing only once deployed on Vercel.
 */
export async function rejectBots(): Promise<Response | null> {
  try {
    const { checkBotId } = await import("botid/server")
    const { isBot } = await checkBotId()
    if (isBot) {
      return Response.json({ error: "Automated access is not allowed." }, { status: 403 })
    }
  } catch (err) {
    console.warn("[botid] check failed, allowing request:", err)
  }
  return null
}

/**
 * Reject a string that is longer than the model/TTS call should ever need.
 * Returns a 400 `Response` to return from the route, or `null` when the value
 * is within bounds (a missing/optional value passes).
 */
export function rejectTooLong(
  value: string | undefined | null,
  max: number,
  field: string,
): Response | null {
  if (typeof value === "string" && value.length > max) {
    return Response.json(
      { error: `${field} is too long (max ${max} characters).` },
      { status: 413 },
    )
  }
  return null
}
