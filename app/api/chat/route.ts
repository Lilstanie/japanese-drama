import { chatParams, createAIClient, friendlyAIError } from "@/lib/model"
import { getScenario } from "@/lib/scenarios"
import type { Message } from "@/lib/types"

export async function POST(request: Request) {
  const client = createAIClient()
  const { scenarioId, messages, userInput } = await request.json() as {
    scenarioId: string
    messages: Message[]
    userInput: string
  }

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
For difficult kanji, add furigana in parentheses like: 食べ物(たべもの).
Keep responses 1-3 sentences — natural conversation pace.
The person you're speaking with is a learner, so be patient and speak clearly.
Current scenario: ${scenario.description}${loadExtraPrompt(scenario.id)}`

  const history = messages.slice(-10).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.content,
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
