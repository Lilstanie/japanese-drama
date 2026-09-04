import { chatParams, createAIClient } from "@/lib/model"

const SYSTEM_A = (topic: string, difficulty: string, seed: string) =>
  `あなたはKenjiです。日本人の26歳男性で、友達のWeiと気楽に話しています。
日本語だけで話してください。絶対に中国語を使わないこと。
会話は自然で、くだけた日本語にしてください。
漢字を含む語には必ずひらがなをカッコ内に付けてください（難しい語だけでなく全部）。例：食べ物(たべもの)、私(わたし)、駅(えき)
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

/**
 * Wei stepping out of the conversation to explain the Japanese just spoken.
 *
 * This is the only way a learner gets an explanation while driving — subtitles
 * are unreadable at the wheel — so it names the meaning and one concrete point,
 * and stays short enough not to derail the conversation it interrupts.
 */
const SYSTEM_EXPLAIN = (difficulty: string) =>
  `你是Wei，正在和日本朋友Kenji聊天。现在请你短暂地停一下，用中文向听众解释Kenji刚才说的那句日语。

只用中文。50字以内。先说这句话的意思，再点出一个词或语法点。
说话像朋友随口讲解，不要像教科书，不要列条目，不要加"Wei:"前缀。
不要重复整句日语原文，最多引用一两个关键词。
学习者水平：${difficulty}`

export async function POST(request: Request) {
  const { topic, difficulty, seed, speaker, history, kind } = (await request.json()) as {
    topic: string
    difficulty: string
    seed: string
    speaker: "A" | "B"
    history: { speaker: "A" | "B"; content: string }[]
    kind?: "dialogue" | "explain"
  }

  // Built per request, not at module scope: Next evaluates route modules while
  // collecting page data at build time, where no key exists.
  const client = createAIClient()

  const system =
    kind === "explain"
      ? SYSTEM_EXPLAIN(difficulty)
      : speaker === "A"
        ? SYSTEM_A(topic, difficulty, seed)
        : SYSTEM_B(topic, difficulty, seed)

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
          ...chatParams(200),
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
