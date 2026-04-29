"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { HIRAGANA_ROWS, KATAKANA_ROWS, type KanaEntry, type KanaRow } from "@/lib/kana"
import { getFromStorage, KANA_PROGRESS_STORAGE_KEY, removeFromStorage, setToStorage } from "@/lib/persistence"

type Tab = "hiragana" | "katakana"
type Status = "idle" | "correct" | "wrong"
type KanaStats = Record<string, { correct: number; wrong: number }>

type KanaProgressSnapshot = {
  tab: Tab
  showOrigin: boolean
  inputsByTab: Record<Tab, Record<string, string>>
  stats: KanaStats
  updatedAt: string
}

function getStatus(entry: KanaEntry, val: string): Status {
  if (!val.trim()) return "idle"
  const accepted = Array.isArray(entry.romaji) ? entry.romaji : [entry.romaji]
  return accepted.includes(val.trim().toLowerCase()) ? "correct" : "wrong"
}

const CELL_STYLE: Record<Status, { bg: string; border: string; color: string; inputBg: string }> = {
  idle:    { bg: "#0f172a", border: "#334155",  color: "#7dd3fc", inputBg: "#111827" },
  correct: { bg: "#061408", border: "#22c55e",  color: "#4ade80", inputBg: "#0a2010" },
  wrong:   { bg: "#1b1120", border: "#f87171",  color: "#7dd3fc", inputBg: "#221326" },
}

function KanaCell({
  entry,
  value,
  showOrigin,
  onChange,
}: {
  entry: KanaEntry
  value: string
  showOrigin: boolean
  onChange: (v: string) => void
}) {
  const s = getStatus(entry, value)
  const c = CELL_STYLE[s]

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl pt-2 pb-2 px-1 transition-all duration-150"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      {showOrigin && (
        <div className="text-xs leading-none" style={{ color: "#94a3b8" }}>
          {entry.origin}
        </div>
      )}

      <div
        className="text-3xl font-bold leading-none select-none"
        style={{ color: c.color, fontFamily: "serif" }}
      >
        {entry.kana}
      </div>

      {/* status line */}
      <div className="text-xs leading-none h-3">
        {s === "correct" && <span style={{ color: "#4ade80" }}>✓</span>}
        {s === "wrong"   && <span style={{ color: "#f87171" }}>✗</span>}
      </div>

      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={5}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full text-center text-xs rounded-md py-1 outline-none transition-all duration-150"
        style={{
          background: c.inputBg,
          border: `1px solid ${s === "idle" ? "#334155" : c.border}`,
          color: s === "correct" ? "#4ade80" : s === "wrong" ? "#f87171" : "#cbd5e1",
          caretColor: "#7dd3fc",
        }}
        placeholder={Array.isArray(entry.romaji) ? entry.romaji[0] : entry.romaji}
      />
    </div>
  )
}

function EmptyCell() {
  return <div className="rounded-xl" style={{ background: "#0b1220", border: "1px solid #1e293b" }} />
}

function KanaGrid({
  rows,
  inputs,
  showOrigin,
  onChange,
}: {
  rows: KanaRow[]
  inputs: Record<string, string>
  showOrigin: boolean
  onChange: (kana: string, val: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {rows.map(row => (
        <div key={row.label}>
          <div
            className="text-xs font-medium mb-2 px-1"
            style={{ color: "#94a3b8", letterSpacing: "0.05em" }}
          >
            {row.label}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {row.cells.map((cell, i) =>
              cell ? (
                <KanaCell
                  key={cell.kana}
                  entry={cell}
                  value={inputs[cell.kana] ?? ""}
                  showOrigin={showOrigin}
                  onChange={v => onChange(cell.kana, v)}
                />
              ) : (
                <EmptyCell key={i} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function KanaPractice() {
  const [tab, setTab] = useState<Tab>("hiragana")
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [showOrigin, setShowOrigin] = useState(true)
  const [stats, setStats] = useState<KanaStats>({})
  const [inputsByTab, setInputsByTab] = useState<Record<Tab, Record<string, string>>>({
    hiragana: {},
    katakana: {},
  })

  const allEntriesMap = useMemo(() => {
    const allEntries = [...HIRAGANA_ROWS, ...KATAKANA_ROWS]
      .flatMap((row) => row.cells.filter((cell): cell is KanaEntry => cell !== null))
    return Object.fromEntries(allEntries.map((entry) => [entry.kana, entry])) as Record<string, KanaEntry>
  }, [])

  const rows = tab === "hiragana" ? HIRAGANA_ROWS : KATAKANA_ROWS
  const allEntries = rows.flatMap(r => r.cells.filter((c): c is KanaEntry => c !== null))
  const correctCount = allEntries.filter(e => getStatus(e, inputs[e.kana] ?? "") === "correct").length
  const total = allEntries.length
  const pct = total ? Math.round((correctCount / total) * 100) : 0
  const allDone = correctCount === total && total > 0

  useEffect(() => {
    const saved = getFromStorage<KanaProgressSnapshot>(KANA_PROGRESS_STORAGE_KEY)
    if (!saved) return
    setTab(saved.tab)
    setShowOrigin(saved.showOrigin)
    setInputsByTab(saved.inputsByTab ?? { hiragana: {}, katakana: {} })
    setInputs(saved.inputsByTab?.[saved.tab] ?? {})
    setStats(saved.stats ?? {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setToStorage<KanaProgressSnapshot>(KANA_PROGRESS_STORAGE_KEY, {
        tab,
        showOrigin,
        inputsByTab,
        stats,
        updatedAt: new Date().toISOString(),
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [tab, showOrigin, inputsByTab, stats])

  function handleInput(kana: string, val: string) {
    const entry = allEntriesMap[kana]
    if (!entry) return
    const prevValue = inputs[kana] ?? ""
    const prevStatus = getStatus(entry, prevValue)
    const nextStatus = getStatus(entry, val)

    setInputs((prev) => ({ ...prev, [kana]: val }))
    setInputsByTab((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [kana]: val },
    }))

    if (prevStatus !== nextStatus && nextStatus !== "idle") {
      setStats((prev) => {
        const current = prev[kana] ?? { correct: 0, wrong: 0 }
        return {
          ...prev,
          [kana]: {
            correct: current.correct + (nextStatus === "correct" ? 1 : 0),
            wrong: current.wrong + (nextStatus === "wrong" ? 1 : 0),
          },
        }
      })
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t)
    setInputs(inputsByTab[t] ?? {})
  }

  function handleReset() {
    setInputs({})
    setInputsByTab((prev) => ({ ...prev, [tab]: {} }))
  }

  function handleClearAllProgress() {
    setInputs({})
    setInputsByTab({ hiragana: {}, katakana: {} })
    setStats({})
    setTab("hiragana")
    setShowOrigin(true)
    removeFromStorage(KANA_PROGRESS_STORAGE_KEY)
  }

  return (
    <div className="min-h-screen" style={{ background: "#020617" }}>
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-4 py-3 border-b"
        style={{ background: "#0b1220", borderColor: "#1e293b" }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm px-3 py-1.5 rounded-lg border flex-shrink-0"
            style={{ color: "#7dd3fc", borderColor: "#334155" }}
          >
            ← 戻る
          </Link>

          <div className="flex-1 min-w-0">
            {/* progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: allDone ? "#4ade80" : "#38bdf8",
                  }}
                />
              </div>
              <span
                className="text-sm font-medium flex-shrink-0 tabular-nums"
                style={{ color: allDone ? "#4ade80" : "#cbd5e1" }}
              >
                {correctCount}/{total}
              </span>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded-lg border flex-shrink-0"
            style={{ color: "#94a3b8", borderColor: "#334155" }}
          >
            リセット
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ color: "#7dd3fc", fontFamily: "serif" }}>
            仮名練習
          </h1>
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            全ての仮名を入力してください · Type the romaji for each kana
          </p>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>
            Correct {Object.values(stats).reduce((sum, s) => sum + s.correct, 0)} · Wrong{" "}
            {Object.values(stats).reduce((sum, s) => sum + s.wrong, 0)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 justify-center mb-5">
          {([["hiragana", "平仮名 ひらがな"], ["katakana", "片仮名 カタカナ"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t ? "#38bdf8" : "#111827",
                color: tab === t ? "#020617" : "#a5b4fc",
                border: "1px solid",
                borderColor: tab === t ? "#38bdf8" : "#334155",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Options row */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={handleClearAllProgress}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ color: "#64748b", borderColor: "#334155" }}
          >
            清空所有进度
          </button>
          <label
            className="flex items-center gap-2 text-xs cursor-pointer select-none"
            style={{ color: "#94a3b8" }}
          >
            <input
              type="checkbox"
              checked={showOrigin}
              onChange={e => setShowOrigin(e.target.checked)}
              className="accent-amber-500"
            />
            显示汉字起源
          </label>
        </div>

        {/* Grid */}
        <KanaGrid
          rows={rows}
          inputs={inputs}
          showOrigin={showOrigin}
          onChange={handleInput}
        />

        {/* Completion banner */}
        {allDone && (
          <div
            className="mt-8 text-center py-8 rounded-2xl"
            style={{ background: "#061408", border: "1px solid #14532d" }}
          >
            <div className="text-5xl mb-3">🎉</div>
            <div className="text-2xl font-bold mb-2" style={{ color: "#4ade80", fontFamily: "serif" }}>
              全問正解！
            </div>
            <div className="text-sm mb-5" style={{ color: "#16a34a" }}>
              {tab === "hiragana" ? "平仮名" : "片仮名"}を全てマスターしました
            </div>
            <button
              onClick={handleReset}
              className="px-6 py-2 rounded-lg text-sm font-medium"
              style={{ background: "#4ade80", color: "#061408" }}
            >
              もう一度
            </button>
          </div>
        )}

        <p className="text-center mt-8 text-xs" style={{ color: "#64748b" }}>
          点击每个输入框，输入罗马音，实时显示正误
        </p>
      </div>
    </div>
  )
}
