"use client"

import Link from "next/link"
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
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3" style={{ color: "#f59e0b", fontFamily: "serif" }}>
          日本語ドラマ
        </h1>
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
      </div>

      <p className="mt-12 text-sm" style={{ color: "#5c3d1e" }}>
        点击场景开始对话 · 随时用 @教练 向教练提问
      </p>
    </div>
  )
}
