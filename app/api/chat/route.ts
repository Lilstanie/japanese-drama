import OpenAI from "openai"
import { getScenario } from "@/lib/scenarios"
import type { Message } from "@/lib/types"

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

export async function POST(request: Request) {
  const { scenarioId, messages, userInput } = await request.json() as {
    scenarioId: string
    messages: Message[]
    userInput: string
  }

  const scenario = getScenario(scenarioId)
  if (!scenario) {
    return Response.json({ error: "Scenario not found" }, { status: 404 })
  }

  const systemPrompt = `You are ${scenario.character.name}, a ${scenario.character.role} in Japan.
Speak only in Japanese. Stay fully in character at all times.
Use natural, conversational Japanese appropriate for the setting.
For difficult kanji, add furigana in parentheses like: 食べ物(たべもの).
Keep responses 1-3 sentences — natural conversation pace.
The person you're speaking with is a learner, so be patient and speak clearly.
Current scenario: ${scenario.description}`

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
          model: "llama-3.3-70b-versatile",
          max_tokens: 512,
          messages: [{ role: "system", content: systemPrompt }, ...history],
          stream: true,
        })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content ?? ""
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        controller.enqueue(encoder.encode(`[错误: ${msg}]`))
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
