/**
 * UI language (zh / en) strings.
 *
 * Only the app *chrome* is translated — the Japanese being taught, and the
 * furigana/katakana/romaji annotations, are the subject matter and never
 * change. The coach's reply language follows the same setting (see the coach
 * API), so an English learner gets English coaching.
 *
 * Both maps hold the same keys; `t()` falls back to Chinese for any gap.
 */

export type Lang = "zh" | "en"

export const LANG_STORAGE_KEY = "jd:v1:lang"

type Dict = Record<string, string>

const zh: Dict = {
  // nav
  "nav.home": "首页",
  "nav.podcast": "播客",
  "nav.practice": "练习",
  "nav.rag": "问答",
  // home
  "home.tagline": "沉浸式情景对话练习 · 中文教练实时辅助",
  "home.scenes": "🎭 情景练习",
  "home.scenes.sub": "· 和 AI 角色对话",
  "home.tools": "🧰 学习工具",
  "home.tools.sub": "· 播客、假名练习和知识问答",
  "home.footer": "点击场景开始对话 · 随时用 @教练 向教练提问",
  "home.podcast.sub": "双语播客",
  "home.podcast.desc": "听 Kenji 和 Wei 用日中双语自由聊天",
  "home.rag.sub": "知识库问答",
  "home.rag.desc": "检索增强生成 · 带引用来源的 AI 问答",
  "home.practice.sub": "字母学习",
  "home.practice.desc": "平仮名・片仮名对照表及测试练习",
  "home.badge.basics": "基础",
  // scene chrome
  "scene.clear": "清空历史",
  "scene.tab.dialog": "💬 对话",
  "scene.tab.coach": "🧑‍🏫 教练",
  "scene.tip": "💡 打开右上角 ローマ字 看每个词的读音，点任意单词即可跟读发音。",
  "scene.tip.dismiss": "知道了 ✕",
  "scene.err.char": "角色回复失败，请重试",
  "scene.err.conn": "连接失败，请重试",
  // dialog panel
  "dp.suffix": "との会話",
  "dp.voice": "⚙ 语音",
  "dp.voice.title": "语音设置：选择 AI / 浏览器语音和音色",
  "dp.aiVoice": "🎙 AI 语音",
  "dp.browserVoice": "💻 浏览器语音",
  "dp.role.character": "角色",
  "dp.role.me": "我",
  "dp.charVoice": "角色声音",
  "dp.myVoice": "我的声音",
  "dp.auto": "🔊 自动",
  "dp.manual": "🔇 手动",
  "dp.auto.on": "开启自动朗读角色台词",
  "dp.auto.off": "关闭自动朗读",
  "dp.speak": "朗读这句",
  "dp.speak.stop": "停止朗读",
  "dp.tapWord": "🔊 点击朗读「{w}」",
  "dp.empty": "👇 轮到你了 —— 用日语回复{name}，或点下方的建议句开始",
  // coach panel
  "coach.title": "中文教练",
  "coach.subtitle": "实时翻译 + 解析",
  "coach.empty.title": "教练会在角色说话后自动出现",
  "coach.empty.sub": "用 @教练 开头可以直接提问",
  // input bar
  "ib.try": "💡 试试说：",
  "ib.placeholder": "用日语回复，或 @教练 提问",
  "ib.placeholder.listening": "正在聆听… 请说日语",
  "ib.placeholder.disabled": "等待回复中…",
  "ib.send": "发送",
  "ib.continue": "让角色继续",
  "ib.reset": "重置",
  "ib.askCoach": "问教练",
  "ib.recording": "● 录音中",
  "ib.mic": "语音输入（日语）",
  "ib.mic.stop": "停止录音",
  "ib.helper": "Enter 发送 · Shift+Enter 换行 · @教练 直接提问教练",
  "ib.helper.mic": " · 🎤 语音输入日语",
  // rag
  "rag.title": "RAG Demo · 日语知识库问答",
  "rag.subtitle": "检索增强生成：分块 → TF-IDF 检索 → LLM 生成（带引用）",
  "rag.stats": "{docs} 篇文档 · {chunks} 个分块 · {retriever}",
  "rag.question": "问题",
  "rag.placeholder": "例如：て形怎么用？居酒屋怎么结账？",
  "rag.run": "运行 RAG",
  "rag.retrieving": "检索中…",
  "rag.generating": "生成中…",
  "rag.results": "检索结果",
  "rag.answer": "生成回答",
  "rag.err.none": "未检索到相关片段，请换一个问题试试。",
  "rag.err.req": "请求失败",
  "rag.cheat": "面试可讲要点",
  // practice
  "pr.saved": "已保存进度：答对 {c} · 答错 {w}",
  "pr.reset": "重置",
  "pr.title.mem": "仮名練習（记忆表）",
  "pr.title.quiz": "仮名練習（测验）",
  "pr.sub.mem": "看熟每个假名（不要抄答案）",
  "pr.sub.quiz": "在下方输入 romaji（罗马音），实时显示正误",
  "pr.score": "答对 {c} · 答错 {w}",
  "pr.mem": "记忆",
  "pr.quiz": "测验",
  "pr.clearAll": "清空所有进度",
  "pr.showOrigin": "显示汉字起源",
  "pr.hideVoiced": "隐藏浊音",
  "pr.memTable": "记忆表",
  "pr.testArea": "测试区",
  "pr.startQuiz": "开始测验 →",
  "pr.quizHint": "点击每个输入框，输入 romaji，实时显示正误",
  // podcast
  "pc.topic": "开始话题",
  "pc.next": "下一个 ⏭",
  "pc.next.title": "跳到下一个话题",
  "pc.level": "難易度",
  "pc.copy": "复制对话",
  "pc.copied": "✓ 已复制",
  "pc.copy.title": "复制对话文本",
  "pc.retry": "重试",
  "pc.empty": "👇 点下方 ▶ 开始 —— Kenji 和 Wei 会用日中双语自由聊天，可锁屏收听，边开车边学。",
  "pc.lockHint": "整段生成后可锁屏播放",
}

const en: Dict = {
  // nav
  "nav.home": "Home",
  "nav.podcast": "Podcast",
  "nav.practice": "Practice",
  "nav.rag": "Q&A",
  // home
  "home.tagline": "Immersive roleplay practice · with a live coach",
  "home.scenes": "🎭 Scenarios",
  "home.scenes.sub": "· talk with an AI character",
  "home.tools": "🧰 Learning tools",
  "home.tools.sub": "· podcast, kana practice and knowledge Q&A",
  "home.footer": "Tap a scenario to start · type @coach anytime to ask the coach",
  "home.podcast.sub": "Bilingual podcast",
  "home.podcast.desc": "Hear Kenji and Wei chat freely in Japanese & Chinese",
  "home.rag.sub": "Knowledge Q&A",
  "home.rag.desc": "Retrieval-augmented answers with cited sources",
  "home.practice.sub": "Kana basics",
  "home.practice.desc": "Hiragana & katakana chart and quiz",
  "home.badge.basics": "Basics",
  // scene chrome
  "scene.clear": "Clear",
  "scene.tab.dialog": "💬 Chat",
  "scene.tab.coach": "🧑‍🏫 Coach",
  "scene.tip": "💡 Turn on ローマ字 (top-right) to see each word's reading, and tap any word to hear it.",
  "scene.tip.dismiss": "Got it ✕",
  "scene.err.char": "The character didn't reply — please try again",
  "scene.err.conn": "Connection failed — please try again",
  // dialog panel
  "dp.suffix": "との会話",
  "dp.voice": "⚙ Voice",
  "dp.voice.title": "Voice settings: AI / browser voice and voice pickers",
  "dp.aiVoice": "🎙 AI Voice",
  "dp.browserVoice": "💻 Browser",
  "dp.role.character": "Character",
  "dp.role.me": "Me",
  "dp.charVoice": "Character voice",
  "dp.myVoice": "My voice",
  "dp.auto": "🔊 Auto",
  "dp.manual": "🔇 Manual",
  "dp.auto.on": "Auto-play the character's lines",
  "dp.auto.off": "Turn off auto-play",
  "dp.speak": "Read aloud",
  "dp.speak.stop": "Stop",
  "dp.tapWord": "🔊 Tap to hear「{w}」",
  "dp.empty": "👇 Your turn — reply to {name} in Japanese, or tap a suggestion below",
  // coach panel
  "coach.title": "English Coach",
  "coach.subtitle": "Live translation + notes",
  "coach.empty.title": "The coach appears after the character speaks",
  "coach.empty.sub": "Start a message with @coach to ask directly",
  // input bar
  "ib.try": "💡 Try saying:",
  "ib.placeholder": "Reply in Japanese, or @coach to ask",
  "ib.placeholder.listening": "Listening… speak Japanese",
  "ib.placeholder.disabled": "Waiting for a reply…",
  "ib.send": "Send",
  "ib.continue": "Continue",
  "ib.reset": "Reset",
  "ib.askCoach": "Ask coach",
  "ib.recording": "● Recording",
  "ib.mic": "Voice input (Japanese)",
  "ib.mic.stop": "Stop recording",
  "ib.helper": "Enter to send · Shift+Enter for newline · @coach to ask the coach",
  "ib.helper.mic": " · 🎤 Japanese voice input",
  // rag
  "rag.title": "RAG Demo · Japanese knowledge Q&A",
  "rag.subtitle": "Retrieval-augmented generation: chunk → TF-IDF retrieve → LLM generate (with citations)",
  "rag.stats": "{docs} docs · {chunks} chunks · {retriever}",
  "rag.question": "Question",
  "rag.placeholder": "e.g. How do you use the て-form? How do you pay at an izakaya?",
  "rag.run": "Run RAG",
  "rag.retrieving": "Retrieving…",
  "rag.generating": "Generating…",
  "rag.results": "Retrieved",
  "rag.answer": "Answer",
  "rag.err.none": "No relevant chunks found — try a different question.",
  "rag.err.req": "Request failed",
  "rag.cheat": "Interview talking points",
  // practice
  "pr.saved": "Saved: {c} correct · {w} wrong",
  "pr.reset": "Reset",
  "pr.title.mem": "仮名練習 (Memorize)",
  "pr.title.quiz": "仮名練習 (Quiz)",
  "pr.sub.mem": "Memorize each kana (don't peek at the answers)",
  "pr.sub.quiz": "Type the romaji below — correctness shows live",
  "pr.score": "{c} correct · {w} wrong",
  "pr.mem": "Memorize",
  "pr.quiz": "Quiz",
  "pr.clearAll": "Clear all progress",
  "pr.showOrigin": "Show kanji origin",
  "pr.hideVoiced": "Hide voiced kana",
  "pr.memTable": "Chart",
  "pr.testArea": "Practice",
  "pr.startQuiz": "Start quiz →",
  "pr.quizHint": "Tap each box, type the romaji — correctness shows live",
  // podcast
  "pc.topic": "Topic",
  "pc.next": "Next ⏭",
  "pc.next.title": "Jump to the next topic",
  "pc.level": "Level",
  "pc.copy": "Copy transcript",
  "pc.copied": "✓ Copied",
  "pc.copy.title": "Copy the transcript",
  "pc.retry": "Retry",
  "pc.empty": "👇 Press ▶ below to start — Kenji and Wei chat freely in Japanese & English; listen on a locked screen, learn on the go.",
  "pc.lockHint": "Playable on a locked screen once generated",
}

export const STRINGS: Record<Lang, Dict> = { zh, en }

/** Look up a string, filling `{name}`-style placeholders, with a zh fallback. */
export function translate(lang: Lang, key: string, vars?: Record<string, string>): string {
  let s = STRINGS[lang]?.[key] ?? STRINGS.zh[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}
