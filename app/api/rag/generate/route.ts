import { chatParams, createAIClient, friendlyAIError } from "@/lib/model"
import { formatChunksForPrompt, retrieve } from "@/lib/rag/index"
import { enforceRateLimit, rejectBots, rejectTooLong } from "@/lib/rate-limit"
import type { RetrievedChunk } from "@/lib/rag/types"

type Lang = "zh" | "en"

function systemPrompt(lang: Lang) {
  if (lang === "en") {
    return `You are a Japanese-learning knowledge-base assistant. Answer primarily from the "retrieved context".
Rules:
1. Use only information in the context; if it is insufficient, clearly say "The knowledge base doesn't have enough information", and you may add general study advice but mark it as not from the knowledge base.
2. Answer in English, concise and clear.
3. Cite sources with [1], [2], etc., matching the chunk numbers in the context.
4. Don't invent specific course policies or features this app doesn't mention.`
  }
  return `你是日语学习知识库助手。你必须优先依据「检索上下文」回答问题。
规则：
1. 只使用上下文中有的信息；若上下文不足，明确说「知识库中没有足够信息」，可给出一般性学习建议但须标注为非知识库内容。
2. 回答用中文，简洁清晰，适合面试/学习者阅读。
3. 引用来源时使用 [1]、[2] 等编号，对应上下文中的片段编号。
4. 不要编造具体的课程政策或本 App 未提及的功能。`
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "rag", limit: 20, windowSec: 60 })
  if (limited) return limited

  const bot = await rejectBots()
  if (bot) return bot

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
  }

  const { query, topK, chunks: clientChunks, lang: rawLang } = (await request.json()) as {
    query?: string
    topK?: number
    chunks?: RetrievedChunk[]
    lang?: string
  }

  const lang: Lang = rawLang === "en" ? "en" : "zh"

  const tooLong = rejectTooLong(query, 1000, "query")
  if (tooLong) return tooLong

  const q = query?.trim()
  if (!q) {
    return Response.json({ error: "query is required" }, { status: 400 })
  }

  // Client-supplied chunks skip retrieval and go straight into the prompt, so
  // bound both their count and size before they can inflate the model call.
  const boundedClientChunks =
    Array.isArray(clientChunks)
      ? clientChunks.slice(0, 8).map((c) => ({ ...c, text: (c.text ?? "").slice(0, 4000) }))
      : []

  const chunks =
    boundedClientChunks.length > 0
      ? boundedClientChunks
      : retrieve(q, Math.min(Math.max(topK ?? 4, 1), 8))

  if (chunks.length === 0) {
    return Response.json(
      { error: "No relevant chunks found. Try a different question." },
      { status: 404 },
    )
  }

  const context = formatChunksForPrompt(chunks)
  const userMessage = lang === "en"
    ? `User question: ${q}\n\nRetrieved context (${chunks.length} chunks):\n\n${context}`
    : `用户问题：${q}\n\n检索上下文（共 ${chunks.length} 段）：\n\n${context}`

  const client = createAIClient()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          ...chatParams(768),
          messages: [
            { role: "system", content: systemPrompt(lang) },
            { role: "user", content: userMessage },
          ],
          stream: true,
        })

        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content ?? ""
          if (text) controller.enqueue(encoder.encode(text))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(friendlyAIError(err, "rag/generate")))
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
