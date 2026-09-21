"use client"

import Link from "next/link"

/**
 * Lightweight global navigation shared by every page.
 *
 * The pages are colour-coded per feature (amber scenes, purple podcast, blue
 * RAG…), so this one amber pill row is deliberately identical everywhere — it
 * is the constant that ties them together and lets a learner jump straight
 * between features instead of always going back through home.
 *
 * `compact` shows icons only, for the crowded scene header.
 */
const ITEMS = [
  { href: "/", label: "首页", icon: "🏠", key: "home" },
  { href: "/podcast", label: "播客", icon: "🎙️", key: "podcast" },
  { href: "/practice", label: "练习", icon: "📖", key: "practice" },
  { href: "/rag", label: "问答", icon: "🔍", key: "rag" },
]

export default function AppNav({
  active,
  compact = false,
}: {
  active?: "home" | "podcast" | "practice" | "rag"
  compact?: boolean
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto max-w-full">
      {ITEMS.map((it) => {
        const on = it.key === active
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            title={it.label}
            className="text-xs px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap transition-all"
            style={
              on
                ? { background: "#f59e0b", color: "#1a0c02", borderColor: "#f59e0b", fontWeight: 600 }
                : { background: "transparent", color: "#9a7a52", borderColor: "#3d2f22" }
            }
          >
            {it.icon}
            {compact ? "" : ` ${it.label}`}
          </Link>
        )
      })}
    </nav>
  )
}
