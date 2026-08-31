"use client"

import { useAnnotations } from "@/components/AnnotationProvider"

/**
 * Toggles the English source words above katakana. Learners switch it off to
 * test whether they can decode a loanword unaided, so it is worth a first-class
 * button next to the romaji toggle rather than burying it in a settings menu.
 */
export default function KatakanaToggle({
  activeColor = "#5eead4",
  idleBackground = "#261508",
  idleColor = "#a07850",
  idleBorder = "#5c3010",
}: {
  activeColor?: string
  idleBackground?: string
  idleColor?: string
  idleBorder?: string
}) {
  const { showKatakanaEn, toggleKatakanaEn } = useAnnotations()

  return (
    <button
      onClick={toggleKatakanaEn}
      className="text-xs px-3 py-1 rounded-lg transition-all"
      style={{
        background: showKatakanaEn ? activeColor : idleBackground,
        color: showKatakanaEn ? "#08201c" : idleColor,
        border: `1px solid ${showKatakanaEn ? activeColor : idleBorder}`,
        fontWeight: showKatakanaEn ? 600 : 400,
      }}
      aria-pressed={showKatakanaEn}
      title={
        showKatakanaEn
          ? "隐藏片假名上方的英文原词"
          : "显示片假名上方的英文原词"
      }
    >
      ABC
    </button>
  )
}
