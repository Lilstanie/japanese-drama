export type TTSMode = "ai" | "web"

let currentMode: TTSMode = "ai"
let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null
let cachedVoices: SpeechSynthesisVoice[] = []

// Incremented by cancelSpeech() to invalidate any in-flight speakAI call
let speakGen = 0
// Resolves the current audio-playback promise immediately when cancelSpeech() is called
let currentCancelResolve: (() => void) | null = null

export function setTTSMode(m: TTSMode) { currentMode = m }
export function getTTSMode(): TTSMode { return currentMode }

// Detect whether text is Japanese (has hiragana / katakana) or Chinese
function detectLang(text: string): "ja" | "zh" {
  return /[ぁ-ゖァ-ヺ]/.test(text) ? "ja" : "zh"
}

// ── ElevenLabs path ────────────────────────────────────────────────────────

async function speakAI(
  text: string,
  speaker: "A" | "B",
  speed: number,
  volume: number
): Promise<void> {
  cleanupAudio()
  const myGen = ++speakGen

  const lang = speaker === "A" ? "ja" : detectLang(text)
  const res = await fetch("/api/podcast/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker, lang }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)

  // cancelSpeech() may have been called during the fetch — bail out silently
  if (speakGen !== myGen) return

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    // Guard again: cancelled between blob() and here
    if (speakGen !== myGen) { URL.revokeObjectURL(url); resolve(); return }

    const audio = new Audio(url)
    audio.playbackRate = Math.max(0.1, speed)
    audio.volume = Math.max(0, Math.min(1, volume))
    currentAudio = audio
    currentObjectUrl = url

    // Store resolver so cancelSpeech() can unblock the loop immediately
    currentCancelResolve = resolve

    const done = () => {
      currentCancelResolve = null
      cleanupAudio()
      resolve()
    }
    audio.onended = done
    audio.onerror = done
    audio.play().catch(done)
  })
}

// ── Web Speech API path ────────────────────────────────────────────────────

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof speechSynthesis === "undefined") return Promise.resolve([])
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices()
    if (v.length > 0) { resolve(v); return }
    const timeout = setTimeout(() => resolve([]), 3000)
    speechSynthesis.onvoiceschanged = () => {
      clearTimeout(timeout)
      resolve(speechSynthesis.getVoices())
    }
  })
}

async function speakWeb(
  text: string,
  speaker: "A" | "B",
  speed: number,
  volume: number
): Promise<void> {
  if (typeof speechSynthesis === "undefined") return
  return new Promise(async (resolve) => {
    speechSynthesis.cancel()
    if (!cachedVoices.length) cachedVoices = await loadVoices()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.volume = Math.max(0, Math.min(1, volume))

    // Use actual text language, not speaker assignment.
    // Wei sometimes replies in Japanese — we still pronounce it correctly.
    const lang = speaker === "A" ? "ja" : detectLang(text)

    if (lang === "ja") {
      utterance.lang = "ja-JP"
      utterance.rate = 0.9 * speed
      utterance.pitch = 1.0
      const voice =
        cachedVoices.find(v => v.lang === "ja-JP" && v.name.toLowerCase().includes("male")) ||
        cachedVoices.find(v => v.lang === "ja-JP")
      if (voice) utterance.voice = voice
    } else {
      utterance.lang = "zh-CN"
      utterance.rate = 0.95 * speed
      utterance.pitch = 1.1
      const voice =
        cachedVoices.find(v => v.lang === "zh-CN") ||
        cachedVoices.find(v => v.lang === "zh-TW") ||
        cachedVoices.find(v => v.lang.startsWith("zh"))
      if (voice) utterance.voice = voice
    }

    // speechSynthesis.cancel() fires utterance.onerror — that resolves the promise cleanly
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    speechSynthesis.speak(utterance)
  })
}

// ── Shared ─────────────────────────────────────────────────────────────────

function cleanupAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null }
}

// Returns true if AI voice was used, false if fell back to Web Speech
export async function speakLine(
  text: string,
  speaker: "A" | "B",
  speed: number,
  volume: number
): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (currentMode === "ai") {
    try {
      await speakAI(text, speaker, speed, volume)
      return true
    } catch (err) {
      console.warn("[tts] ElevenLabs failed, falling back to Web Speech:", err)
    }
  }
  await speakWeb(text, speaker, speed, volume)
  return false
}

export function cancelSpeech() {
  // Invalidate any in-flight speakAI fetch or playback
  speakGen++
  // Unblock the loop immediately if it's awaiting an audio promise
  if (currentCancelResolve) {
    const r = currentCancelResolve
    currentCancelResolve = null
    r()
  }
  cleanupAudio()
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel()
}

export function initBackgroundAudio() {
  if (typeof window === "undefined") return
  try {
    const ctx = new AudioContext()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
  } catch { /* unsupported */ }
}
