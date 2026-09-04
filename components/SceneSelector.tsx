"use client"

import Link from "next/link"
import Image from "next/image"
import type { Scenario } from "@/lib/types"

const DIFFICULTY_COLORS: Record<string, string> = {
  N5: "bg-green-900/60 text-green-300 border-green-700",
  N4: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  N3: "bg-orange-900/60 text-orange-300 border-orange-700",
}

export default function SceneSelector({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "#1a1008" }}>
      <div className="mb-12 text-center flex flex-col items-center gap-3">
        <Image
          src="/logo.png"
          alt="日本語ドラマ"
          width={110}
          height={110}
          className="rounded-2xl shadow-lg"
          priority
        />
        <p className="text-lg" style={{ color: "#d4a96a" }}>
          沉浸式情景对话练习 · 中文教练实时辅助
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {scenarios.map((scenario) => (
          <Link key={scenario.id} href={`/scene/${scenario.id}`}>
            <div
              className="rounded-xl border p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl"
              style={{
                background: "#261508",
                borderColor: "#5c3d1e",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
            >
              <div className="text-5xl mb-4 text-center">{scenario.emoji}</div>
              <div className="text-center mb-3">
                <span className="text-xl font-bold" style={{ color: "#f59e0b", fontFamily: "serif" }}>
                  {scenario.titleJa}
                </span>
                <span className="ml-2 text-sm" style={{ color: "#a07850" }}>
                  {scenario.title}
                </span>
              </div>
              <p className="text-sm text-center mb-4" style={{ color: "#c4956a" }}>
                {scenario.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "#7a5c38" }}>
                  {scenario.character.name} ({scenario.character.role})
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded border ${DIFFICULTY_COLORS[scenario.difficulty] || "bg-gray-800 text-gray-400 border-gray-600"}`}
                >
                  {scenario.difficulty}
                </span>
              </div>
            </div>
          </Link>
        ))}

        {/* Podcast card */}
        <Link href="/podcast">
          <div
            className="rounded-xl border p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl"
            style={{
              background: "#10101a",
              borderColor: "#2a2050",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-5xl mb-4 text-center">🎙️</div>
            <div className="text-center mb-3">
              <span className="text-xl font-bold" style={{ color: "#a78bfa", fontFamily: "serif" }}>
                物語 Podcast
              </span>
              <span className="ml-2 text-sm" style={{ color: "#4c3a7a" }}>
                双语播客
              </span>
            </div>
            <p className="text-sm text-center mb-4" style={{ color: "#6d5aab" }}>
              听Kenji和Wei用日中双语自由聊天
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#4c3a7a" }}>🇯🇵 日本語 · 🇨🇳 中文</span>
              <span
                className="text-xs px-2 py-0.5 rounded border"
                style={{ background: "rgba(42,32,80,0.6)", color: "#a78bfa", borderColor: "#2a2050" }}
              >
                Podcast
              </span>
            </div>
          </div>
        </Link>

        {/* RAG demo card */}
        <Link href="/rag">
          <div
            className="rounded-xl border p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl"
            style={{
              background: "#0c1018",
              borderColor: "#1e3a5f",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-5xl mb-4 text-center">🔍</div>
            <div className="text-center mb-3">
              <span className="text-xl font-bold" style={{ color: "#60a5fa", fontFamily: "serif" }}>
                RAG Demo
              </span>
              <span className="ml-2 text-sm" style={{ color: "#3b5a80" }}>
                知识库问答
              </span>
            </div>
            <p className="text-sm text-center mb-4" style={{ color: "#6b8299" }}>
              检索增强生成 · 带引用来源的 AI 问答
            </p>
            <div className="flex items-center justify-end">
              <span
                className="text-xs px-2 py-0.5 rounded border"
                style={{ background: "rgba(30,58,95,0.5)", color: "#60a5fa", borderColor: "#1e3a5f" }}
              >
                RAG
              </span>
            </div>
          </div>
        </Link>

        {/* Kana practice card */}
        <Link href="/practice">
          <div
            className="rounded-xl border p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl"
            style={{
              background: "#0e1a10",
              borderColor: "#1e4028",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div className="text-5xl mb-4 text-center">📖</div>
            <div className="text-center mb-3">
              <span className="text-xl font-bold" style={{ color: "#4ade80", fontFamily: "serif" }}>
                仮名練習
              </span>
              <span className="ml-2 text-sm" style={{ color: "#2d6040" }}>
                字母学习
              </span>
            </div>
            <p className="text-sm text-center mb-4" style={{ color: "#3a7a50" }}>
              平仮名・片仮名对照表及测试练习
            </p>
            <div className="flex items-center justify-end">
              <span
                className="text-xs px-2 py-0.5 rounded border"
                style={{ background: "rgba(30,64,40,0.6)", color: "#4ade80", borderColor: "#1e4028" }}
              >
                基础
              </span>
            </div>
          </div>
        </Link>
      </div>

      <p className="mt-12 text-sm" style={{ color: "#5c3d1e" }}>
        点击场景开始对话 · 随时用 @教练 向教练提问
      </p>
    </div>
  )
}
