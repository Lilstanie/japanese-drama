"use client"

import Link from "next/link"
import { useLang } from "@/components/LanguageProvider"
import LanguageToggle from "@/components/LanguageToggle"

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
  { href: "/", icon: "🏠", key: "home" },
  { href: "/podcast", icon: "🎙️", key: "podcast" },
  { href: "/practice", icon: "📖", key: "practice" },
  { href: "/rag", icon: "🔍", key: "rag" },
] as const

export default function AppNav({
  active,
  compact = false,
}: {
  active?: "home" | "podcast" | "practice" | "rag"
  compact?: boolean
}) {
  const { t } = useLang()
  return (
    <nav className="flex items-center gap-1 overflow-x-auto max-w-full">
      {ITEMS.map((it) => {
        const on = it.key === active
        const label = t(`nav.${it.key}`)
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            aria-label={label}
            title={label}
            className="text-xs px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap transition-all"
            style={
              on
                ? { background: "#f59e0b", color: "#1a0c02", borderColor: "#f59e0b", fontWeight: 600 }
                : { background: "transparent", color: "#9a7a52", borderColor: "#3d2f22" }
            }
          >
            {it.icon}
            {compact ? "" : ` ${label}`}
          </Link>
        )
      })}
      <span className="ml-1 shrink-0">
        <LanguageToggle />
      </span>
    </nav>
  )
}
