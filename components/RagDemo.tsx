"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import type { RagIndexStats, RetrievedChunk } from "@/lib/rag/types"

const SAMPLE_QUESTIONS = [
  "は 和 が 有什么区别？",
  "居酒屋怎么点单和结账？",
  "Podcast 模式怎么用？",
  "中文学习者学日语常犯什么错？",
]

type PipelineStep = "idle" | "retrieving" | "retrieved" | "generating" | "done" | "error"

export default function RagDemo() {
  const [query, setQuery] = useState("")
  const [topK, setTopK] = useState(4)
  const [step, setStep] = useState<PipelineStep>("idle")
  const [chunks, setChunks] = useState<RetrievedChunk[]>([])
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<RagIndexStats | null>(null)

  useEffect(() => {
    fetch("/api/rag/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  const runRag = useCallback(async () => {
    const q = query.trim()
    if (!q) return

    setError(null)
    setAnswer("")
    setChunks([])
    setStep("retrieving")

    try {
      const retrieveRes = await fetch("/api/rag/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, topK }),
      })

      if (!retrieveRes.ok) {
        const body = await retrieveRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Retrieve failed")
      }

      const { chunks: retrieved } = (await retrieveRes.json()) as {
        chunks: RetrievedChunk[]
      }

      setChunks(retrieved)
      setStep("retrieved")

      if (retrieved.length === 0) {
        setError("未检索到相关片段，请换一个问题试试。")
        setStep("error")
        return
      }

      setStep("generating")

      const genRes = await fetch("/api/rag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, chunks: retrieved }),
      })

      if (!genRes.ok || !genRes.body) {
        const body = await genRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Generate failed")
      }

      const reader = genRes.body.getReader()
      const decoder = new TextDecoder()
      let text = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setAnswer(text)
      }

      setStep("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败")
      setStep("error")
    }
  }, [query, topK])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0c1018", color: "#c8d4e8" }}
    >
      <header
        className="border-b px-4 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: "#1e2a40" }}
      >
        <div>
          <Link
            href="/"
            className="text-sm mb-1 inline-block"
            style={{ color: "#5a7090" }}
          >
            ← 返回首页
          </Link>
          <h1 className="text-xl font-bold" style={{ color: "#60a5fa" }}>
            RAG Demo · 日语知识库问答
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b8299" }}>
            检索增强生成：分块 → TF-IDF 检索 → Groq 生成（带引用）
          </p>
        </div>
        {stats && (
          <div
            className="text-xs rounded-lg border px-3 py-2"
            style={{ borderColor: "#1e2a40", color: "#8aa0b8" }}
          >
            {stats.documentCount} 篇文档 · {stats.chunkCount} 个分块 ·{" "}
            {stats.retriever.toUpperCase()}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Pipeline indicator */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { key: "retrieve", label: "1. Retrieve", active: step !== "idle" },
            {
              key: "augment",
              label: "2. Augment",
              active: ["retrieved", "generating", "done"].includes(step),
            },
            {
              key: "generate",
              label: "3. Generate",
              active: ["generating", "done"].includes(step),
            },
          ].map((s) => (
            <span
              key={s.key}
              className="px-3 py-1 rounded-full border"
              style={{
                borderColor: s.active ? "#3b82f6" : "#1e2a40",
                background: s.active ? "rgba(59,130,246,0.15)" : "transparent",
                color: s.active ? "#93c5fd" : "#4a5a70",
              }}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Query */}
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: "#1e2a40", background: "#101820" }}
        >
          <label className="text-sm block mb-2" style={{ color: "#8aa0b8" }}>
            问题
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：て形怎么用？居酒屋怎么结账？"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2"
            style={{
              background: "#0c1018",
              borderColor: "#2a3a55",
              color: "#e2e8f0",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void runRag()
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="text-xs flex items-center gap-2" style={{ color: "#6b8299" }}>
              Top-K
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="rounded border px-2 py-1 text-xs"
                style={{ background: "#0c1018", borderColor: "#2a3a55", color: "#c8d4e8" }}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void runRag()}
              disabled={!query.trim() || step === "retrieving" || step === "generating"}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: "#2563eb", color: "#fff" }}
            >
              {step === "retrieving"
                ? "检索中…"
                : step === "generating"
                  ? "生成中…"
                  : "运行 RAG"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="text-xs px-2 py-1 rounded border"
                style={{ borderColor: "#2a3a55", color: "#8aa0b8" }}
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "#3f1010", color: "#fca5a5" }}>
            {error}
          </p>
        )}

        {/* Retrieved chunks */}
        {chunks.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#93c5fd" }}>
              检索结果 ({chunks.length})
            </h2>
            <div className="grid gap-3">
              {chunks.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl border p-4 text-sm"
                  style={{ borderColor: "#1e3a5f", background: "#0f1824" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-medium" style={{ color: "#60a5fa" }}>
                      [{c.rank}] {c.documentTitle}
                    </span>
                    <span className="text-xs" style={{ color: "#6b8299" }}>
                      {c.category} · score {c.score}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed" style={{ color: "#a8b8cc" }}>
                    {c.text}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Answer */}
        {(answer || step === "generating") && (
          <section
            className="rounded-xl border p-4"
            style={{ borderColor: "#1e3a5f", background: "#0f1824" }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#4ade80" }}>
              生成回答
            </h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#d4e4f4" }}>
              {answer || "…"}
            </p>
          </section>
        )}

        {/* Interview cheat sheet */}
        <section
          className="rounded-xl border p-4 text-xs leading-relaxed"
          style={{ borderColor: "#1e2a40", color: "#6b8299" }}
        >
          <p className="font-semibold mb-2" style={{ color: "#8aa0b8" }}>
            面试可讲要点
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <code className="text-[10px]">lib/rag/</code>：corpus → chunk → TF-IDF index → retrieve
            </li>
            <li>
              API 拆分：<code className="text-[10px]">/api/rag/retrieve</code> 与{" "}
              <code className="text-[10px]">/api/rag/generate</code>，便于演示流水线
            </li>
            <li>生产可替换：embedding + pgvector / Pinecone；此处零依赖 TF-IDF 便于本地跑通</li>
            <li>扩展 Agent：把 retrieve 封装为 tool，LLM 通过 function calling 决定是否检索</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
