import { chatParams, createAIClient, friendlyAIError } from "@/lib/model"
import { getScenario } from "@/lib/scenarios"
import { enforceRateLimit, rejectTooLong } from "@/lib/rate-limit"
import type { Message } from "@/lib/types"

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "chat", limit: 30, windowSec: 60 })
  if (limited) return limited

  const client = createAIClient()
  const { scenarioId, messages, userInput } = await request.json() as {
    scenarioId: string
    messages: Message[]
    userInput: string
  }

  const tooLong = rejectTooLong(userInput, 4000, "userInput")
  if (tooLong) return tooLong

  const scenario = getScenario(scenarioId)
  if (!scenario) {
    return Response.json({ error: "Scenario not found" }, { status: 404 })
  }

  function loadExtraPrompt(id: string): string {
    const raw = process.env.EXTRA_PROMPTS_JSON
    if (!raw) return ""
    try {
      const map = JSON.parse(raw) as Record<string, string>
      return map[id] ?? ""
    } catch { return "" }
  }

  const systemPrompt = `You are ${scenario.character.name}, a ${scenario.character.role} in Japan.
Speak only in Japanese. Stay fully in character at all times.
Use natural, conversational Japanese appropriate for the setting.
Add furigana in parentheses after EVERY word containing kanji, not just difficult ones: 食べ物(たべもの), 私(わたし), 駅(えき).
Put the reading of the whole word in one pair of parentheses, immediately after it.
Keep responses 1-3 sentences — natural conversation pace.
The person you're speaking with is a learner, so be patient and speak clearly.
Current scenario: ${scenario.description}${loadExtraPrompt(scenario.id)}`

  const history = (Array.isArray(messages) ? messages : []).slice(-10).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    // Clamp each prior turn so a crafted client can't stuff the prompt.
    content: (m.content ?? "").slice(0, 4000),
  }))

  history.push({ role: "user" as const, content: userInput })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          ...chatParams(512),
          messages: [{ role: "system", content: systemPrompt }, ...history],
          stream: true,
        })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content ?? ""
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(friendlyAIError(err, "chat")))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  })
}
