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

export const SCENARIOS: Scenario[] = [...BASE_SCENARIOS, ...loadExtraScenarios()]

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
