"use client"

import { useState, useRef, useEffect, useCallback } from "react"

export default function InputBar({
  onSend,
  onContinue,
  onReset,
  disabled,
}: {
  onSend: (text: string) => void
  onContinue: () => void
  onReset: () => void
  disabled: boolean
}) {
  const [value, setValue] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState("")
  const [hasSpeech, setHasSpeech] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const baseValueRef = useRef("") // textarea content before speech started
  const finalAccumRef = useRef("") // final transcript accumulated this session
  const stoppingRef = useRef(false) // true when we called stop() intentionally

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.SpeechRecognition || w.webkitSpeechRecognition) setHasSpeech(true)
  }, [])

  // Auto-resize textarea height as user types
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }, [value])

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    stopListening(false) // don't overwrite value, we'll clear manually
    onSend(trimmed)
    setValue("")
    baseValueRef.current = ""
    finalAccumRef.current = ""
  }

  const stopListening = useCallback((commit = true) => {
    stoppingRef.current = true
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (commit) {
      const committed = (baseValueRef.current + finalAccumRef.current).trimStart()
      setValue(committed)
      baseValueRef.current = committed
    } else {
      setValue(baseValueRef.current)
    }
    finalAccumRef.current = ""
    // stoppingRef stays true — reset happens in startRecognition, not here
    setIsListening(false)
    setInterimText("")
  }, [])

  function startRecognition() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return

    stoppingRef.current = false
    const rec = new SR()
    rec.lang = "ja-JP"
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setIsListening(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalAccum = ""
      let interim = ""
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalAccum += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      finalAccumRef.current = finalAccum
      setValue((baseValueRef.current + finalAccum + interim).trimStart())
      setInterimText(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return
      stopListening(true)
    }

    rec.onend = () => {
      if (!stoppingRef.current) {
        // Browser ended the session on its own — create a fresh instance to keep going
        startRecognition()
        return
      }
      recognitionRef.current = null
      setIsListening(false)
      setInterimText("")
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
    }
  }

  function toggleListening() {
    if (isListening) {
      stopListening()
      return
    }
    baseValueRef.current = value
    finalAccumRef.current = ""
    startRecognition()
  }

  const isCoachQuestion = value.startsWith("@教练")
  const displayInterim = isListening && interimText

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: "#3d2010", background: "#140a02" }}
    >
      <div className="flex gap-2 items-end max-w-full">
        {/* Mic button */}
        {hasSpeech && (
          <button
            onClick={toggleListening}
            disabled={disabled}
            title={isListening ? "停止录音" : "语音输入（日语）"}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all"
            style={{
              background: isListening ? "#7f1d1d" : disabled ? "#1e0e04" : "#2d1508",
              border: `1px solid ${isListening ? "#ef4444" : disabled ? "#2d1508" : "#5c3010"}`,
              color: isListening ? "#fca5a5" : disabled ? "#5c3010" : "#a07050",
              cursor: disabled ? "not-allowed" : "pointer",
              animation: isListening ? "micPulse 1s ease-in-out infinite" : "none",
            }}
          >
            {isListening ? "⏹" : "🎤"}
          </button>
        )}

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              baseValueRef.current = e.target.value
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={
              isListening
                ? "正在聆听… 请说日语"
                : disabled
                ? "等待回复中…"
                : "用日语回复 · 或 @教练 开头提问 · Enter 发送"
            }
            className="w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: disabled ? "#1e0e04" : "#2d1508",
              color: displayInterim
                ? "#a07050"
                : isCoachQuestion
                ? "#93c5fd"
                : "#f0d5a0",
              border: isListening
                ? "1px solid #ef4444"
                : isCoachQuestion
                ? "1px solid #2563eb"
                : "1px solid #5c3010",
              caretColor: "#f59e0b",
              minHeight: "42px",
              maxHeight: "120px",
            }}
          />
          {isCoachQuestion && !isListening && (
            <span
              className="absolute right-3 top-2.5 text-xs"
              style={{ color: "#60a5fa" }}
            >
              问教练
            </span>
          )}
          {isListening && (
            <span
              className="absolute right-3 top-2.5 text-xs"
              style={{ color: "#f87171" }}
            >
              ● 录音中
            </span>
          )}
        </div>

        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background:
              disabled || !value.trim() ? "#3d2010" : "#f59e0b",
            color: disabled || !value.trim() ? "#7a5c38" : "#1a0c02",
            cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          }}
        >
          发送
        </button>

        <button
          onClick={onContinue}
          disabled={disabled}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
          style={{
            background: disabled ? "#1a1020" : "#1e3050",
            color: disabled ? "#374d6a" : "#93c5fd",
            border: "1px solid",
            borderColor: disabled ? "#1e2030" : "#2563eb",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          让角色继续
        </button>

        <button
          onClick={onReset}
          disabled={disabled}
          className="px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{
            background: "transparent",
            color: disabled ? "#3d2010" : "#7a5c38",
            border: "1px solid",
            borderColor: disabled ? "#2d1508" : "#5c3010",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          title="重置场景"
        >
          重置
        </button>
      </div>

      <p className="text-xs mt-2" style={{ color: "#3d2010" }}>
        Enter 发送 · Shift+Enter 换行 · @教练 直接提问教练
        {hasSpeech && " · 🎤 语音输入日语"}
      </p>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  )
}
