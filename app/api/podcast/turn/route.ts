import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

const SYSTEM_A = (topic: string, difficulty: string, seed: string) =>
  `あなたはKenjiです。日本人の26歳男性で、友達のWeiと気楽に話しています。
日本語だけで話してください。絶対に中国語を使わないこと。
会話は自然で、くだけた日本語にしてください。
難しい漢字にはひらがなをカッコ内に付けてください。例：食べ物(たべもの)
返答は1〜2文で、短く。会話のリズムを保つこと。
「Kenji:」のような名前のプレフィックスは絶対に付けないでください。
難易度: ${difficulty}
トピック: ${topic}
背景: ${seed}`

const SYSTEM_B = (topic: string, difficulty: string, seed: string) =>
  `你是Wei，26岁中国人，从小在中国长大，日语说得不太好。你和日本朋友Kenji用普通话聊天，因为Kenji想练习中文听力。
你只能用普通话（中文）回答，绝对不能说日语——哪怕Kenji说日语，你也用中文回应。
说话口语化，像真正的朋友聊天，不要文绉绉。每次回复1-2句，简短自然。
不要在回复前加"Wei:"这样的名字前缀，直接说话。
话题：${topic}
背景：${seed}
难度参考：${difficulty}`

export async function POST(request: Request) {
  const { topic, difficulty, seed, speaker, history } = (await request.json()) as {
    topic: string
    difficulty: string
    seed: string
    speaker: "A" | "B"
    history: { speaker: "A" | "B"; content: string }[]
  }

  const system = speaker === "A" ? SYSTEM_A(topic, difficulty, seed) : SYSTEM_B(topic, difficulty, seed)

  const recentHistory = history.slice(-8)
  const formatted = recentHistory
    .map((h) => `${h.speaker === "A" ? "Kenji" : "Wei"}: ${h.content}`)
    .join("\n")

  const userMessage =
    speaker === "A"
      ? formatted
        ? `これまでの会話:\n${formatted}\n\nあなたの次のセリフを言ってください。`
        : "会話を自然に始めてください。"
      : formatted
      ? `对话记录（用中文回答！）:\n${formatted}\n\n请用中文说你的下一句话。`
      : "请用中文开始对话，说第一句话。"

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 200,
          messages: [
            { role: "system", content: system },
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
        controller.enqueue(encoder.encode(`[エラー: ${msg}]`))
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
