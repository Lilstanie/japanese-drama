import { AI_API_KEY, CHAT_MODEL, chatParams, createAIClient } from "@/lib/model"
import { lookupLoanword, NON_LOANWORDS } from "@/lib/katakana-dict"
import { isKatakanaTerm } from "@/lib/katakana"

/** Katakana the static dictionary misses gets one model lookup, then is cached. */
const MAX_TERMS_PER_REQUEST = 12
const MAX_TERM_LENGTH = 24

/**
 * Cross-request cache. Loanword glosses never change, so this survives for the
 * life of the server process and keeps repeat traffic off the model entirely.
 * `null` is a real cached value: "asked, and it is not a loanword".
 */
const serverCache = new Map<string, string | null>()
const MAX_SERVER_CACHE = 5000

function cacheGloss(term: string, gloss: string | null) {
  if (serverCache.size >= MAX_SERVER_CACHE) {
    const oldest = serverCache.keys().next().value
    if (oldest !== undefined) serverCache.delete(oldest)
  }
  serverCache.set(term, gloss)
}

const SYSTEM_PROMPT = `You identify the source words behind Japanese katakana terms.

For each katakana term you are given, decide whether it is 外来語 (a loanword borrowed from a foreign language).

Reply with a JSON object of the exact shape:
{"glosses": {"<katakana term>": "<source word>" | null}}

Rules:
- Include every term you were given as a key, spelled exactly as given.
- The value is the ORIGINAL foreign word the katakana came from, in its own script (Latin alphabet).
- Keep it SHORT — at most 3 words. It is displayed above the katakana in a chat bubble.
- If the source is not English, give the original word then a short English meaning in parentheses, e.g. "Gelände (slope)" for ゲレンデ, "Arbeit (part-time job)" for アルバイト.
- Use null when the term is NOT a loanword: onomatopoeia (ドキドキ), native Japanese words written in katakana for emphasis (ヤバイ), Japanese place or person names, and company/brand names.
- Never invent an English word that merely sounds similar. If you are unsure, use null.
- No explanations, no markdown — JSON only.`

export async function POST(request: Request) {
  let body: { terms?: unknown }
  try {
    body = (await request.json()) as { terms?: unknown }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.terms)) {
    return Response.json({ error: "terms must be an array" }, { status: 400 })
  }

  // Only well-formed katakana of a plausible length reaches the model.
  const requested = [
    ...new Set(
      body.terms.filter(
        (t): t is string =>
          typeof t === "string" &&
          t.length >= 2 &&
          t.length <= MAX_TERM_LENGTH &&
          isKatakanaTerm(t)
      )
    ),
  ].slice(0, MAX_TERMS_PER_REQUEST)

  const glosses: Record<string, string | null> = {}
  const needsModel: string[] = []

  for (const term of requested) {
    if (NON_LOANWORDS.has(term)) {
      glosses[term] = null
      continue
    }

    const entry = lookupLoanword(term)
    if (entry) {
      glosses[term] = entry.en
      continue
    }

    if (serverCache.has(term)) {
      glosses[term] = serverCache.get(term)!
      continue
    }

    needsModel.push(term)
  }

  if (!needsModel.length) {
    return Response.json({ glosses, source: "dictionary" as const })
  }

  if (!AI_API_KEY) {
    // Without a key the dictionary still answers; unknown terms just stay bare.
    return Response.json({ glosses, source: "dictionary" as const })
  }

  const client = createAIClient()

  try {
    const completion = await client.chat.completions.create({
      ...chatParams(512),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ terms: needsModel }) },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw) as { glosses?: Record<string, unknown> }
    const returned = parsed.glosses ?? {}

    // A term the model simply did not answer is NOT evidence that it is not a
    // loanword. Weaker models garble katakana keys — asked about ハンドクリーム,
    // gpt-oss-20b replied about ホンドクレーマー — and caching those as null
    // would permanently suppress a valid annotation. Only an explicit null in
    // the response counts as "not a loanword".
    let unanswered = 0

    for (const term of needsModel) {
      if (!(term in returned)) {
        unanswered++
        continue
      }

      const value = returned[term]
      const gloss =
        typeof value === "string" && value.trim() && value.trim().length <= 40
          ? value.trim()
          : null
      glosses[term] = gloss
      cacheGloss(term, gloss)
    }

    if (unanswered) {
      console.warn(
        `[katakana/gloss] ${CHAT_MODEL} left ${unanswered}/${needsModel.length} terms unanswered`
      )
    }

    // `partial` keeps the unanswered terms uncached so a later request retries.
    return Response.json({
      glosses,
      source: unanswered ? ("partial" as const) : ("model" as const),
    })
  } catch (err) {
    // A model failure must not break rendering — return what the dictionary knew
    // and report `partial` so the client leaves the rest unresolved and retries
    // later, rather than caching "not a loanword" for a transient outage.
    console.error("[katakana/gloss] model lookup failed:", err)
    return Response.json({ glosses, source: "partial" as const })
  }
}
