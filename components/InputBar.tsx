"use client"

import { useState, useRef, useEffect } from "react"

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    onSend(trimmed)
    setValue("")
  }

  const isCoachQuestion = value.startsWith("@教练")

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: "#3d2010", background: "#140a02" }}
    >
      <div className="flex gap-2 items-end max-w-full">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={
              disabled
                ? "等待回复中…"
                : "用日语回复 · 或 @教练 开头提问 · Enter 发送"
            }
            className="w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: disabled ? "#1e0e04" : "#2d1508",
              color: isCoachQuestion ? "#93c5fd" : "#f0d5a0",
              border: isCoachQuestion
                ? "1px solid #2563eb"
                : "1px solid #5c3010",
              caretColor: "#f59e0b",
              minHeight: "42px",
              maxHeight: "120px",
            }}
          />
          {isCoachQuestion && (
            <span
              className="absolute right-3 top-2.5 text-xs"
              style={{ color: "#60a5fa" }}
            >
              问教练
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
      </p>
    </div>
  )
}
