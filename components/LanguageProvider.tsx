"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { type Lang, LANG_STORAGE_KEY, translate } from "@/lib/i18n"
import { getFromStorage, setToStorage } from "@/lib/persistence"

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Translate a key, filling `{name}`-style placeholders. */
  t: (key: string, vars?: Record<string, string>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "zh",
  setLang: () => {},
  t: (key) => key,
})

export function useLang() {
  return useContext(LanguageContext)
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to Chinese so SSR and the first client render agree; the stored
  // choice is applied after mount (a brief flash for English users, same
  // pattern the katakana setting uses).
  const [lang, setLangState] = useState<Lang>("zh")

  useEffect(() => {
    const saved = getFromStorage<Lang>(LANG_STORAGE_KEY)
    if (saved === "zh" || saved === "en") setLangState(saved)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    setToStorage(LANG_STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => translate(lang, key, vars),
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
