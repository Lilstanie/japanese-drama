"use client"

import { useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || loading) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      })
      if (!res.ok) {
        setError(true)
        setLoading(false)
        return
      }
      // Full navigation so the gate re-runs with the fresh cookie and serves
      // the originally requested page.
      const raw = new URLSearchParams(window.location.search).get("from") ?? "/"
      const dest = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"
      window.location.assign(dest)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#1a1008" }}
    >
      <Image
        src="/logo.png"
        alt="日本語ドラマ"
        width={88}
        height={88}
        className="rounded-2xl shadow-lg mb-6"
        priority
      />
      <form
        onSubmit={submit}
        className="w-full max-w-xs flex flex-col gap-3 rounded-2xl border p-6"
        style={{ background: "#261508", borderColor: "#5c3d1e" }}
      >
        <label className="text-sm font-medium" style={{ color: "#f0d5a0" }}>
          你的名字是？
        </label>
        <input
          type="password"
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); setError(false) }}
          autoFocus
          autoComplete="off"
          placeholder="请输入"
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "#1a0c02",
            color: "#f0d5a0",
            border: `1px solid ${error ? "#ef4444" : "#5c3010"}`,
            caretColor: "#f59e0b",
          }}
        />
        {error && (
          <span className="text-xs" style={{ color: "#fca5a5" }}>
            不对哦，再试试 🙃
          </span>
        )}
        <button
          type="submit"
          disabled={loading || !answer.trim()}
          className="rounded-lg px-3 py-2 text-sm font-medium transition-all"
          style={{
            background: loading || !answer.trim() ? "#3d2010" : "#f59e0b",
            color: loading || !answer.trim() ? "#7a5c38" : "#1a0c02",
            cursor: loading || !answer.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "进入中…" : "进入"}
        </button>
      </form>
    </div>
  )
}
