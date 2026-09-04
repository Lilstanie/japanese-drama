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
/**
 * Per-turn instruction. Without one the model settles into agreeable closure
 * formulas and the conversation loops while every line still reads naturally.
 */
const MOVE_JA: Record<string, string> = {
  open: "この話題を、具体的な場面から始めてください。いつ・どこで・何が、を一つ入れること。",
  ask: "相手にまだ聞いていないことを、具体的に一つ質問してください。",
  detail: "固有名詞・数字・地名のどれかを必ず一つ入れて、新しい情報を足してください。",
  contrast: "日本と中国の違いを一つ挙げてください。相手の国のことは決めつけず、聞く形にすること。",
  anecdote: "自分の体験を短く一つ語ってください。失敗談でも構いません。",
  disagree: "相手に軽く反論するか、自分は苦手だと正直に言ってください。同意で終わらせないこと。",
  shift: "同じ話題の中で、まだ話していない別の角度に話を移してください。",
  close: "この話題に短く区切りをつけてください。ただし次の約束はしないこと。",
}

const MOVE_ZH: Record<string, string> = {
  open: "从一个具体场景开头，说清楚时间、地点或人物中的一个。",
  ask: "问对方一个还没问过的、具体的问题。",
  detail: "补充一条新信息，必须包含一个具体的名字、数字或地名。",
  contrast: "说一个中国和日本的差别，用请教的语气，不要替对方下结论。",
  anecdote: "讲一件你自己的具体经历，可以是糗事。",
  disagree: "对对方的说法提出一点不同意见，或者坦白说自己不喜欢。不要一味附和。",
  shift: "在同一个话题里，转到一个还没聊过的角度。",
  close: "给这个话题做一个简短的收尾，但不要约下次。",
}

/**
 * Japanese closure formulas are a stable attractor: they are always a valid
 * reply, so once both speakers enter that mode neither leaves, and the
 * conversation loops on 「感想を聞かせて」/「楽しみにしてる」 forever.
 */
const NO_LOOP_JA = `絶対に守ること：
- 相手が今言ったことを言い換えて返さない。必ず新しい中身を足すこと。
- 「〜してみてね」「楽しみにしてるね」「感想を聞かせて」「また今度」で終わらせない。
- 会話をまとめようとしない。まだ続く前提で話すこと。`

const NO_LOOP_ZH = `绝对要求：
- 不要把对方刚说的话换个说法再说一遍，每次必须加入新内容。
- 不要用「期待」「到时候告诉我」「下次一起」这类客套话收尾。
- 不要试图总结或结束对话，就当聊天还会继续。`

const SYSTEM_EXPLAIN = (difficulty: string) =>
  `你是Wei，正在和日本朋友Kenji聊天。现在请你短暂地停一下，用中文向听众解释Kenji刚才说的那句日语。

只用中文。50字以内。先说这句话的意思，再点出一个词或语法点。
说话像朋友随口讲解，不要像教科书，不要列条目，不要加"Wei:"前缀。
不要重复整句日语原文，最多引用一两个关键词。
学习者水平：${difficulty}`

export async function POST(request: Request) {
  const { topic, difficulty, seed, speaker, history, kind, move } = (await request.json()) as {
    topic: string
    difficulty: string
    seed: string
    speaker: "A" | "B"
    history: { speaker: "A" | "B"; content: string }[]
    kind?: "dialogue" | "explain"
    move?: string
  }

  // Built per request, not at module scope: Next evaluates route modules while
  // collecting page data at build time, where no key exists.
  const client = createAIClient()

  const system =
    kind === "explain"
      ? SYSTEM_EXPLAIN(difficulty)
      : speaker === "A"
        ? `${SYSTEM_A(topic, difficulty, seed)}\n\n今回の役割: ${MOVE_JA[move ?? "detail"] ?? MOVE_JA.detail}\n\n${NO_LOOP_JA}`
        : `${SYSTEM_B(topic, difficulty, seed)}\n\n本轮任务：${MOVE_ZH[move ?? "detail"] ?? MOVE_ZH.detail}\n\n${NO_LOOP_ZH}`

  const recentHistory = history.slice(-8)
  const formatted = recentHistory
    .map((h) => `${h.speaker === "A" ? "Kenji" : "Wei"}: ${h.content}`)
    .join("\n")

  // An explanation needs only the line being explained. Handing it the whole
  // conversation plus "say your next line" made it carry on chatting instead —
  // the concrete task in the user message beat the system prompt.
  const lastJapanese = [...history].reverse().find((h) => h.speaker === "A")?.content

  const userMessage =
    kind === "explain"
      ? lastJapanese
        ? `请解释下面这句日语：\n\n${lastJapanese}\n\n用中文说出它的意思，再点出一个词或语法点。不要接着聊天，不要提问。`
        : "请用中文简单说明日语中「〜てください」的用法。"
      : speaker === "A"
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
          // The prompt does most of the work, but repeating a phrase the model
          // just produced is exactly what these penalise.
          frequency_penalty: 0.6,
          presence_penalty: 0.5,
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
