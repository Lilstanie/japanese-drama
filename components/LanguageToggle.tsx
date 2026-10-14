"use client"

import { useLang } from "@/components/LanguageProvider"

/**
 * 中 / EN switch for the whole UI. Switches chrome strings and the coach's
 * reply language; the Japanese being taught is unaffected.
 */
export default function LanguageToggle() {
  const { lang, setLang } = useLang()
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden shrink-0 text-xs"
      style={{ border: "1px solid #3d2f22" }}
      role="group"
      aria-label="Language / 语言"
    >
      {(["zh", "en"] as const).map((l) => {
        const on = lang === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={on}
            className="px-2 py-1 transition-all"
            style={{
              background: on ? "#f59e0b" : "transparent",
              color: on ? "#1a0c02" : "#9a7a52",
              fontWeight: on ? 600 : 400,
            }}
          >
            {l === "zh" ? "中" : "EN"}
          </button>
        )
      })}
    </div>
  )
}
