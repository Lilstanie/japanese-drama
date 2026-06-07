import OpenAI from "openai"
import { formatChunksForPrompt, retrieve } from "@/lib/rag/index"
import type { RetrievedChunk } from "@/lib/rag/types"

const SYSTEM_PROMPT = `你是日语学习知识库助手。你必须优先依据「检索上下文」回答问题。
规则：
1. 只使用上下文中有的信息；若上下文不足，明确说「知识库中没有足够信息」，可给出一般性学习建议但须标注为非知识库内容。
2. 回答用中文，简洁清晰，适合面试/学习者阅读。
3. 引用来源时使用 [1]、[2] 等编号，对应上下文中的片段编号。
4. 不要编造具体的课程政策或本 App 未提及的功能。`

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
  }

  const { query, topK, chunks: clientChunks } = (await request.json()) as {
    query?: string
    topK?: number
    chunks?: RetrievedChunk[]
  }

  const q = query?.trim()
  if (!q) {
    return Response.json({ error: "query is required" }, { status: 400 })
  }

  const chunks =
    clientChunks && clientChunks.length > 0
      ? clientChunks
      : retrieve(q, Math.min(Math.max(topK ?? 4, 1), 8))

  if (chunks.length === 0) {
    return Response.json(
      { error: "No relevant chunks found. Try a different question." },
      { status: 404 },
    )
  }

  const context = formatChunksForPrompt(chunks)
  const userMessage = `用户问题：${q}\n\n检索上下文（共 ${chunks.length} 段）：\n\n${context}`

  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 768,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
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
      "X-Rag-Chunk-Count": String(chunks.length),
    },
  })
}
