"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { collectUnglossedTerms } from "@/lib/katakana"
import { getFromStorage, setToStorage } from "@/lib/persistence"

const SHOW_KEY = "jd:v1:katakana:show"
const CACHE_KEY = "jd:v1:katakana:glosses"

/** Terms resolved by the LLM are cached forever; trim oldest first past this. */
const MAX_CACHED_GLOSSES = 2000
/** Batch window — long enough to coalesce a streaming reply's repeated calls. */
const BATCH_DELAY_MS = 400
/** One request stays small so a slow model never blocks the whole transcript. */
const MAX_BATCH_SIZE = 12

type AnnotationContextValue = {
  /** Whether English source words render above katakana. */
  showKatakanaEn: boolean
  toggleKatakanaEn: () => void
  /** term → source word, or null for "looked up, not a loanword". */
  glosses: Map<string, string | null>
  /** Queue any unglossed katakana in `text` for lookup. Safe to call every render. */
  requestGlosses: (text: string) => void
}

const AnnotationContext = createContext<AnnotationContextValue>({
  showKatakanaEn: true,
  toggleKatakanaEn: () => {},
  glosses: new Map(),
  requestGlosses: () => {},
})

export function useAnnotations() {
  return useContext(AnnotationContext)
}

export default function AnnotationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [showKatakanaEn, setShowKatakanaEn] = useState(true)
  const [glosses, setGlosses] = useState<Map<string, string | null>>(new Map())

  // Terms waiting for the next batch, and terms already in flight. Refs rather
  // than state: mutating them must not re-render or the batch timer restarts.
  const pendingRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The ref is the authoritative cache; `glosses` state only mirrors it so the
  // tree re-renders. Child effects (which call requestGlosses) run before the
  // parent's, so reading state there would be a render stale and re-queue terms
  // that are already resolved.
  const glossesRef = useRef<Map<string, string | null>>(new Map())

  const commitGlosses = useCallback((next: Map<string, string | null>) => {
    glossesRef.current = next
    setGlosses(next)
  }, [])

  // Hydrate from localStorage after mount so SSR markup stays stable.
  useEffect(() => {
    const savedShow = getFromStorage<boolean>(SHOW_KEY)
    if (typeof savedShow === "boolean") setShowKatakanaEn(savedShow)

    const savedCache = getFromStorage<Record<string, string | null>>(CACHE_KEY)
    if (savedCache) commitGlosses(new Map(Object.entries(savedCache)))
  }, [commitGlosses])

  const toggleKatakanaEn = useCallback(() => {
    setShowKatakanaEn((prev) => {
      setToStorage(SHOW_KEY, !prev)
      return !prev
    })
  }, [])

  const flush = useCallback(async () => {
    timerRef.current = null

    const terms = [...pendingRef.current].slice(0, MAX_BATCH_SIZE)
    if (!terms.length) return
    terms.forEach((t) => {
      pendingRef.current.delete(t)
      inFlightRef.current.add(t)
    })

    try {
      const res = await fetch("/api/katakana/gloss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = (await res.json()) as {
        glosses?: Record<string, string | null>
        source?: "dictionary" | "model" | "partial"
      }
      if (!data.glosses) throw new Error("malformed response")

      const next = new Map(glossesRef.current)
      for (const [term, gloss] of Object.entries(data.glosses)) {
        next.set(term, gloss)
      }

      // A term the server resolved is authoritative; a term missing from a
      // complete answer means "not a loanword" and is cached as null so we stop
      // asking. `partial` means the model call itself failed, so those terms
      // stay uncached and a later render retries them.
      if (data.source !== "partial") {
        for (const term of terms) if (!next.has(term)) next.set(term, null)
      }

      const trimmed =
        next.size > MAX_CACHED_GLOSSES
          ? new Map([...next].slice(next.size - MAX_CACHED_GLOSSES))
          : next
      setToStorage(CACHE_KEY, Object.fromEntries(trimmed))
      commitGlosses(trimmed)
    } catch {
      // Leave the terms unresolved but out of `inFlight` so a later render can
      // retry. Katakana simply renders unannotated in the meantime.
    } finally {
      terms.forEach((t) => inFlightRef.current.delete(t))
      if (pendingRef.current.size && !timerRef.current) {
        timerRef.current = setTimeout(flush, BATCH_DELAY_MS)
      }
    }
  }, [commitGlosses])

  const requestGlosses = useCallback(
    (text: string) => {
      if (!text) return

      const unknown = collectUnglossedTerms(text, glossesRef.current)
      let added = false
      for (const term of unknown) {
        if (inFlightRef.current.has(term) || pendingRef.current.has(term)) continue
        pendingRef.current.add(term)
        added = true
      }

      if (added && !timerRef.current) {
        timerRef.current = setTimeout(flush, BATCH_DELAY_MS)
      }
    },
    [flush]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const value = useMemo(
    () => ({ showKatakanaEn, toggleKatakanaEn, glosses, requestGlosses }),
    [showKatakanaEn, toggleKatakanaEn, glosses, requestGlosses]
  )

  return (
    <AnnotationContext.Provider value={value}>
      {children}
    </AnnotationContext.Provider>
  )
}
