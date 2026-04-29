const SCENE_PREFIX = "jd:v1:scene:"
const KANA_KEY = "jd:v1:kana:progress"

export function sceneStorageKey(scenarioId: string) {
  return `${SCENE_PREFIX}${scenarioId}`
}

export function getFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write failures (private mode/full quota)
  }
}

export function removeFromStorage(key: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage removal failures
  }
}

export const KANA_PROGRESS_STORAGE_KEY = KANA_KEY
