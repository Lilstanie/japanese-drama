import OpenAI from "openai"
import type { Message } from "@/lib/types"

const COACH_SYSTEM_PROMPT = `你是一个亲切的中文日语教练，正在陪一个中文母语者学日语。
你的任务是在每次日本角色说话后，用中文：
1. 翻译那句日语（自然的中文，不要逐字翻译）
2. 点出1-2个值得学的语法点或词汇，简短解释
3. 给出1-2个用户可以回应的日语句子建议（附中文意思）
语气要像朋友，不要像教科书。简洁，有趣。`

const COACH_QUESTION_SYSTEM_PROMPT = `你是一个亲切的中文日语教练，正在陪一个中文母语者学日语。
用户用@教练开头向你提问。请直接用中文回答他的问题，语气像朋友，简洁有用。`

export async function POST(request: Request) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  })

  const { characterLine, dialogMessages, isDirectQuestion, question } =
    await request.json() as {
      characterLine?: string
      dialogMessages: Message[]
      isDirectQuestion?: boolean
      question?: string
    }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (isDirectQuestion && question) {
          const response = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 512,
            messages: [
              { role: "system", content: COACH_QUESTION_SYSTEM_PROMPT },
              { role: "user", content: question },
            ],
            stream: true,
          })

          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content ?? ""
            if (text) controller.enqueue(encoder.encode(text))
          }
        } else if (characterLine) {
          const recentContext = dialogMessages
            .slice(-5)
            .map((m) => `${m.role === "user" ? "学习者" : "角色"}：${m.content}`)
            .join("\n")

          const userMessage = `对话背景：\n${recentContext}\n\n日本角色刚说：「${characterLine}」\n\n请分析这句话。`

          const response = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            max_tokens: 512,
            messages: [
              { role: "system", content: COACH_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            stream: true,
          })

          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content ?? ""
            if (text) controller.enqueue(encoder.encode(text))
          }
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
