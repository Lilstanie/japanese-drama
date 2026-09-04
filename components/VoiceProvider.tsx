"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ROLES, voiceByName, type VoiceRole } from "@/lib/voices"
import { getFromStorage, setToStorage } from "@/lib/persistence"

const STORAGE_KEY = "jd:v1:voices"

type VoiceContextValue = {
  /** Chosen voice name per role. */
  voices: Record<VoiceRole, string>
  setVoice: (role: VoiceRole, name: string) => void
  /** Voice name to send with a TTS request for this role. */
  voiceFor: (role: VoiceRole) => string
}

const defaults = () =>
  Object.fromEntries(
    (Object.keys(ROLES) as VoiceRole[]).map((r) => [r, ROLES[r].fallback])
  ) as Record<VoiceRole, string>

const VoiceContext = createContext<VoiceContextValue>({
  voices: defaults(),
  setVoice: () => {},
  voiceFor: (role) => ROLES[role].fallback,
})

export function useVoices() {
  return useContext(VoiceContext)
}

export default function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [voices, setVoices] = useState<Record<VoiceRole, string>>(defaults)

  // Hydrate after mount so server and client render the same markup.
  useEffect(() => {
    const saved = getFromStorage<Partial<Record<VoiceRole, string>>>(STORAGE_KEY)
    if (!saved) return

    setVoices((prev) => {
      const next = { ...prev }
      for (const role of Object.keys(ROLES) as VoiceRole[]) {
        const name = saved[role]
        // Ignore a stored voice that no longer exists or changed language —
        // the catalogue can be edited between visits.
        const voice = voiceByName(name)
        if (voice && voice.language === ROLES[role].language) next[role] = name!
      }
      return next
    })
  }, [])

  const setVoice = useCallback((role: VoiceRole, name: string) => {
    setVoices((prev) => {
      const next = { ...prev, [role]: name }
      setToStorage(STORAGE_KEY, next)
      return next
    })
  }, [])

  const voiceFor = useCallback(
    (role: VoiceRole) => voices[role] ?? ROLES[role].fallback,
    [voices]
  )

  const value = useMemo(
    () => ({ voices, setVoice, voiceFor }),
    [voices, setVoice, voiceFor]
  )

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}
