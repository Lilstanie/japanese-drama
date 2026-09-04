/**
 * Podcast topics.
 *
 * Built for listening on a drive: the player rotates through these rather than
 * staying on one, so `category` exists to keep consecutive topics from feeling
 * like the same conversation twice. `seed` sets the scene concretely — a vague
 * seed produces vague small talk, which is the failure mode that makes a
 * generated podcast tiring to listen to.
 */

export type TopicCategory = "daily" | "culture" | "travel" | "work" | "hobby"

export type PodcastTopic = {
  id: string
  label: string
  labelZh: string
  emoji: string
  difficulty: "N5" | "N4" | "N3"
  category: TopicCategory
  seed: string
}

export const PODCAST_TOPICS: PodcastTopic[] = [
  // ─── 日常 ───────────────────────────────────────────────────────
  {
    id: "izakaya", label: "居酒屋での会話", labelZh: "居酒屋聊天", emoji: "🍺",
    difficulty: "N4", category: "daily",
    seed: "Kenji and Wei are unwinding after work at their favorite izakaya in Shinjuku.",
  },
  {
    id: "food", label: "食べ物の話", labelZh: "聊美食", emoji: "🍜",
    difficulty: "N5", category: "daily",
    seed: "Kenji is teaching Wei about Japanese regional foods. Wei compares them to Chinese dishes.",
  },
  {
    id: "shopping", label: "買い物", labelZh: "逛街购物", emoji: "🛍️",
    difficulty: "N5", category: "daily",
    seed: "Kenji and Wei are shopping in Shibuya. Wei wants souvenirs but can't read the labels.",
  },
  {
    id: "convenience-store", label: "コンビニ", labelZh: "便利店", emoji: "🏪",
    difficulty: "N5", category: "daily",
    seed: "Wei is amazed by what a Japanese convenience store sells. Kenji explains the everyday items.",
  },
  {
    id: "weather", label: "天気の話", labelZh: "聊天气", emoji: "🌦️",
    difficulty: "N5", category: "daily",
    seed: "It is the rainy season. Kenji and Wei complain about the humidity and plan around it.",
  },
  {
    id: "morning-routine", label: "朝のルーティン", labelZh: "早晨习惯", emoji: "☕",
    difficulty: "N5", category: "daily",
    seed: "Kenji and Wei compare their morning routines. Kenji wakes up much earlier than Wei.",
  },
  {
    id: "apartment", label: "部屋探し", labelZh: "找房子", emoji: "🏠",
    difficulty: "N4", category: "daily",
    seed: "Wei is apartment hunting in Tokyo. Kenji explains key money, layouts like 1LDK, and station distance.",
  },

  // ─── 文化 ───────────────────────────────────────────────────────
  {
    id: "anime", label: "アニメ・漫画", labelZh: "动漫话题", emoji: "🎌",
    difficulty: "N4", category: "culture",
    seed: "Kenji and Wei debate their favorite anime. Wei is a huge One Piece fan.",
  },
  {
    id: "festivals", label: "日本のお祭り", labelZh: "日本祭典", emoji: "🎆",
    difficulty: "N4", category: "culture",
    seed: "Kenji describes a summer festival — yukata, food stalls, fireworks. Wei has never been.",
  },
  {
    id: "manners", label: "日本のマナー", labelZh: "日本礼仪", emoji: "🙇",
    difficulty: "N4", category: "culture",
    seed: "Wei asks about rules he keeps getting wrong: trains, chopsticks, escalators, gift-giving.",
  },
  {
    id: "language-quirks", label: "日本語の面白い表現", labelZh: "有趣的日语表达", emoji: "💬",
    difficulty: "N3", category: "culture",
    seed: "Kenji explains expressions with no clean Chinese equivalent — お疲れさま, よろしく, 微妙.",
  },
  {
    id: "music", label: "音楽の話", labelZh: "聊音乐", emoji: "🎵",
    difficulty: "N4", category: "culture",
    seed: "Kenji and Wei swap music recommendations. Wei is getting into Japanese city pop.",
  },

  // ─── 旅行 ───────────────────────────────────────────────────────
  {
    id: "travel-plans", label: "旅行の計画", labelZh: "旅行计划", emoji: "✈️",
    difficulty: "N5", category: "travel",
    seed: "Kenji and Wei are planning a weekend trip to Kyoto together.",
  },
  {
    id: "train-travel", label: "電車の乗り方", labelZh: "坐电车", emoji: "🚄",
    difficulty: "N4", category: "travel",
    seed: "Wei got on the wrong express train. Kenji explains local vs rapid vs limited express.",
  },
  {
    id: "onsen", label: "温泉に行く", labelZh: "泡温泉", emoji: "♨️",
    difficulty: "N4", category: "travel",
    seed: "First onsen trip for Wei. Kenji walks through the etiquette, which Wei finds intimidating.",
  },
  {
    id: "hotel", label: "ホテルでのやりとり", labelZh: "住酒店", emoji: "🏨",
    difficulty: "N5", category: "travel",
    seed: "Checking into a ryokan. Wei practises asking about breakfast times and luggage.",
  },
  {
    id: "countryside", label: "田舎の旅", labelZh: "乡下旅行", emoji: "🌾",
    difficulty: "N3", category: "travel",
    seed: "Kenji describes his hometown in rural Nagano — depopulation, hot springs, and quiet.",
  },

  // ─── 工作 ───────────────────────────────────────────────────────
  {
    id: "work", label: "仕事の愚痴", labelZh: "吐槽工作", emoji: "💼",
    difficulty: "N3", category: "work",
    seed: "Kenji and Wei complain about their workweeks. Both had rough days.",
  },
  {
    id: "job-interview", label: "面接の話", labelZh: "面试经历", emoji: "📋",
    difficulty: "N3", category: "work",
    seed: "Wei has a Japanese job interview coming up. Kenji coaches him on keigo and expected questions.",
  },
  {
    id: "remote-work", label: "リモートワーク", labelZh: "远程办公", emoji: "💻",
    difficulty: "N4", category: "work",
    seed: "Kenji misses the office; Wei prefers working from home. They argue about it good-naturedly.",
  },

  // ─── 兴趣 ───────────────────────────────────────────────────────
  {
    id: "ski-resort", label: "スキー場の話", labelZh: "聊滑雪", emoji: "🏂",
    difficulty: "N4", category: "hobby",
    seed: "Kenji is teaching Wei to snowboard at Hakuba. Wei keeps falling; Kenji is full of tips.",
  },
  {
    id: "baseball", label: "野球の話", labelZh: "聊棒球", emoji: "⚾",
    difficulty: "N4", category: "hobby",
    seed: "Kenji explains why baseball is huge in Japan, and the chanting at a Hanshin Tigers game.",
  },
  {
    id: "cooking", label: "料理を作る", labelZh: "做菜", emoji: "🍳",
    difficulty: "N4", category: "hobby",
    seed: "Wei attempts miso soup for the first time. Kenji talks him through dashi step by step.",
  },
  {
    id: "gaming", label: "ゲームの話", labelZh: "聊游戏", emoji: "🎮",
    difficulty: "N4", category: "hobby",
    seed: "Kenji and Wei compare retro games they grew up with in Japan and China.",
  },
]

export const TOPIC_CATEGORY_LABEL: Record<TopicCategory, string> = {
  daily: "日常",
  culture: "文化",
  travel: "旅行",
  work: "工作",
  hobby: "兴趣",
}

export function topicById(id: string): PodcastTopic | undefined {
  return PODCAST_TOPICS.find((t) => t.id === id)
}
