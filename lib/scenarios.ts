import type { Scenario } from "./types"

const BASE_SCENARIOS: Scenario[] = [
  {
    id: "convenience-store",
    title: "便利店",
    titleJa: "コンビニ",
    emoji: "🏪",
    description: "你走进一家7-Eleven，要买东西和问路",
    character: { name: "田中さん", role: "店员" },
    opening: "いらっしゃいませ！何かお探しですか？",
    difficulty: "N5",
  },
  {
    id: "izakaya",
    title: "居酒屋",
    titleJa: "居酒屋",
    emoji: "🍺",
    description: "你和日本朋友去居酒屋，要点菜聊天",
    character: { name: "Kenji", role: "朋友" },
    opening: "お疲れ！何飲む？ビールでいい？",
    difficulty: "N4",
  },
  {
    id: "train-station",
    title: "车站问路",
    titleJa: "駅",
    emoji: "🚉",
    description: "你在新宿站迷路了，要向站务员问路",
    character: { name: "駅員さん", role: "站务员" },
    opening: "どうされましたか？お困りですか？",
    difficulty: "N5",
  },
  {
    id: "ski-resort",
    title: "白马滑雪场",
    titleJa: "白馬スキー場",
    emoji: "🏂",
    description: "你在日本长野县白马村的スキー場，正在跟职业教练鈴木コーチ学习单板滑雪（スノーボード）。鈴木コーチ有20年执教经验，精通所有单板技术（重心控制、刹车、转弯、跳跃），也深知日本滑雪文化、山地安全规则和礼仪。你是初学者，刚穿好雪板站在初级坡道顶端。教练会用日语一步步指导你，鼓励你，回答你关于技术和雪场的任何问题。",
    character: { name: "鈴木(すずき)コーチ", role: "スノーボード教練" },
    opening: "よし、準備(じゅんび)はいい？スノーボードは最初(さいしょ)ちょっと難(むずか)しいけど、絶対(ぜったい)できるよ！まずは体(からだ)の重心(じゅうしん)から教(おし)えてあげるね。",
    difficulty: "N4",
  },
]

function loadExtraScenarios(): Scenario[] {
  const raw = process.env.EXTRA_SCENARIOS_JSON
  if (!raw) return []
  try {
    return JSON.parse(raw) as Scenario[]
  } catch {
    return []
  }
}

// Temporary frontend hide list so scenarios can be re-enabled later.
const HIDDEN_SCENARIO_IDS = new Set(["kyabakura"])

export const SCENARIOS: Scenario[] = [...BASE_SCENARIOS, ...loadExtraScenarios()].filter(
  (scenario) => !HIDDEN_SCENARIO_IDS.has(scenario.id),
)

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
