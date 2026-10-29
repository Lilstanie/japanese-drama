"use client"

import AppNav from "@/components/AppNav"
import { useCallback, useEffect, useState } from "react"
import type { RagIndexStats, RetrievedChunk } from "@/lib/rag/types"
import { useLang } from "@/components/LanguageProvider"

const SAMPLE_QUESTIONS_ZH = [
  "は 和 が 有什么区别？",
  "居酒屋怎么点单和结账？",
  "Podcast 模式怎么用？",
  "中文学习者学日语常犯什么错？",
]

const SAMPLE_QUESTIONS_EN = [
  "What's the difference between は and が?",
  "How do you order and pay at an izakaya?",
  "How does Podcast mode work?",
  "What mistakes do learners often make in Japanese?",
]

type PipelineStep = "idle" | "retrieving" | "retrieved" | "generating" | "done" | "error"

export default function RagDemo() {
  const { lang, t } = useLang()
  const SAMPLE_QUESTIONS = lang === "en" ? SAMPLE_QUESTIONS_EN : SAMPLE_QUESTIONS_ZH
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
        setError(t("rag.err.none"))
        setStep("error")
        return
      }

      setStep("generating")

      const genRes = await fetch("/api/rag/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, chunks: retrieved, lang }),
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
      setError(e instanceof Error ? e.message : t("rag.err.req"))
      setStep("error")
    }
  }, [query, topK, lang, t])

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
          <div className="mb-2">
            <AppNav active="rag" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#60a5fa" }}>
            {t("rag.title")}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b8299" }}>
            {t("rag.subtitle")}
          </p>
        </div>
        {stats && (
          <div
            className="text-xs rounded-lg border px-3 py-2"
            style={{ borderColor: "#1e2a40", color: "#8aa0b8" }}
          >
            {t("rag.stats", {
              docs: String(stats.documentCount),
              chunks: String(stats.chunkCount),
              retriever: stats.retriever.toUpperCase(),
            })}
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
            {t("rag.question")}
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rag.placeholder")}
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
                ? t("rag.retrieving")
                : step === "generating"
                  ? t("rag.generating")
                  : t("rag.run")}
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
              {t("rag.results")} ({chunks.length})
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
              {t("rag.answer")}
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
            {t("rag.cheat")}
          </p>
          {lang === "en" ? (
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <code className="text-[10px]">lib/rag/</code>: corpus → chunk → TF-IDF index → retrieve
              </li>
              <li>
                Split APIs: <code className="text-[10px]">/api/rag/retrieve</code> and{" "}
                <code className="text-[10px]">/api/rag/generate</code>, so the pipeline is easy to demo
              </li>
              <li>Swap for production: embedding + pgvector / Pinecone; zero-dep TF-IDF here runs locally with nothing to set up</li>
              <li>Extend to an Agent: wrap retrieve as a tool and let the LLM decide via function calling whether to retrieve</li>
            </ul>
          ) : (
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
          )}
        </section>
      </main>
    </div>
  )
}
