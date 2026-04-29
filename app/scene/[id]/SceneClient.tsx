"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import DialogPanel from "@/components/DialogPanel"
import CoachPanel from "@/components/CoachPanel"
import InputBar from "@/components/InputBar"
import type { Message, Scenario } from "@/lib/types"
import { getFromStorage, removeFromStorage, sceneStorageKey, setToStorage } from "@/lib/persistence"

function makeId() {
  return Math.random().toString(36).slice(2)
}

async function streamResponse(
  url: string,
  body: object,
  onChunk: (chunk: string) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onChunk(full)
  }

  return full
}

type ActiveTab = "dialog" | "coach"

type StoredMessage = {
  id: string
  role: Message["role"]
  content: string
  timestamp: string
}

type SceneSessionSnapshot = {
  dialogMessages: StoredMessage[]
  coachMessages: StoredMessage[]
  showRomaji: boolean
  updatedAt: string
}

function toStoredMessage(message: Message): StoredMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString(),
  }
}

function fromStoredMessage(message: StoredMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.timestamp),
  }
}

export default function SceneClient({ scenario }: { scenario: Scenario }) {
  const router = useRouter()

  const [dialogMessages, setDialogMessages] = useState<Message[]>([
    { id: makeId(), role: "character", content: scenario.opening, timestamp: new Date() },
  ])
  const [coachMessages, setCoachMessages] = useState<Message[]>([])
  const [charStreaming, setCharStreaming] = useState(false)
  const [charStreamText, setCharStreamText] = useState("")
  const [coachStreaming, setCoachStreaming] = useState(false)
  const [coachStreamText, setCoachStreamText] = useState("")
  const [showRomaji, setShowRomaji] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>("dialog")
  const [hasNewCoach, setHasNewCoach] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const storageKey = sceneStorageKey(scenario.id)

  // Restore last conversation for this scenario
  useEffect(() => {
    const saved = getFromStorage<SceneSessionSnapshot>(storageKey)
    if (!saved) return
    if (saved.dialogMessages?.length) {
      setDialogMessages(saved.dialogMessages.map(fromStoredMessage))
    }
    if (saved.coachMessages?.length) {
      setCoachMessages(saved.coachMessages.map(fromStoredMessage))
    }
    if (typeof saved.showRomaji === "boolean") {
      setShowRomaji(saved.showRomaji)
    }
  }, [storageKey])

  // Persist scenario session with debounce to reduce frequent writes
  useEffect(() => {
    const timer = setTimeout(() => {
      const snapshot: SceneSessionSnapshot = {
        dialogMessages: dialogMessages.map(toStoredMessage),
        coachMessages: coachMessages.map(toStoredMessage),
        showRomaji,
        updatedAt: new Date().toISOString(),
      }
      setToStorage(storageKey, snapshot)
    }, 400)
    return () => clearTimeout(timer)
  }, [storageKey, dialogMessages, coachMessages, showRomaji])


  const isDisabled = charStreaming || coachStreaming

  // When a new coach message arrives while on dialog tab, show badge
  useEffect(() => {
    if (coachMessages.length > 0 && activeTab === "dialog") {
      setHasNewCoach(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachMessages.length])

  // Auto-switch to coach tab on mobile when coach starts streaming
  useEffect(() => {
    if (coachStreaming) {
      setActiveTab("coach")
      setHasNewCoach(false)
    }
  }, [coachStreaming])

  async function runCoach(
    characterLine: string,
    currentDialog: Message[],
    isDirectQuestion = false,
    question = ""
  ) {
    setCoachStreaming(true)
    setCoachStreamText("")
    setErrorMsg(null)
    try {
      const full = await streamResponse(
        "/api/coach",
        isDirectQuestion
          ? { isDirectQuestion: true, question, dialogMessages: currentDialog, scenarioId: scenario.id }
          : { characterLine, dialogMessages: currentDialog, scenarioId: scenario.id },
        setCoachStreamText
      )
      setCoachMessages((prev) => [
        ...prev,
        { id: makeId(), role: "coach", content: full, timestamp: new Date() },
      ])
    } catch {
      // Coach failure is non-fatal — just clear streaming state silently
    } finally {
      setCoachStreaming(false)
      setCoachStreamText("")
    }
  }

  async function handleSend(input: string) {
    setActiveTab("dialog")
    setErrorMsg(null)

    if (input.startsWith("@教练")) {
      setActiveTab("coach")
      await runCoach("", dialogMessages, true, input.slice(3).trim())
      return
    }

    const userMsg: Message = { id: makeId(), role: "user", content: input, timestamp: new Date() }
    const newDialog = [...dialogMessages, userMsg]
    setDialogMessages(newDialog)
    setCharStreaming(true)
    setCharStreamText("")

    try {
      const charLine = await streamResponse(
        "/api/chat",
        { scenarioId: scenario.id, messages: newDialog.filter(m => m.role !== "coach"), userInput: input },
        setCharStreamText
      )
      const charMsg: Message = { id: makeId(), role: "character", content: charLine, timestamp: new Date() }
      const finalDialog = [...newDialog, charMsg]
      setDialogMessages(finalDialog)
      setCharStreaming(false)
      setCharStreamText("")
      await runCoach(charLine, finalDialog)
    } catch {
      setCharStreaming(false)
      setCharStreamText("")
      setErrorMsg("角色回复失败，请重试")
    }
  }

  async function handleContinue() {
    setActiveTab("dialog")
    setErrorMsg(null)
    setCharStreaming(true)
    setCharStreamText("")
    const continuePrompt = dialogMessages.length <= 1
      ? "（场景开始，请继续对话）"
      : "（请继续推进对话，提出新的内容或问题）"

    try {
      const charLine = await streamResponse(
        "/api/chat",
        { scenarioId: scenario.id, messages: dialogMessages, userInput: continuePrompt },
        setCharStreamText
      )
      const charMsg: Message = { id: makeId(), role: "character", content: charLine, timestamp: new Date() }
      const finalDialog = [...dialogMessages, charMsg]
      setDialogMessages(finalDialog)
      setCharStreaming(false)
      setCharStreamText("")
      await runCoach(charLine, finalDialog)
    } catch {
      setCharStreaming(false)
      setCharStreamText("")
      setErrorMsg("连接失败，请重试")
    }
  }

  function handleReset() {
    const starter = [{ id: makeId(), role: "character" as const, content: scenario.opening, timestamp: new Date() }]
    setDialogMessages(starter)
    setCoachMessages([])
    setCharStreamText("")
    setCoachStreamText("")
    setErrorMsg(null)
    setHasNewCoach(false)
    setActiveTab("dialog")
    removeFromStorage(storageKey)
  }

  const tabBtn = (tab: ActiveTab, label: string, badge?: boolean) => (
    <button
      onClick={() => { setActiveTab(tab); if (tab === "coach") setHasNewCoach(false) }}
      className="flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
      style={{
        color: activeTab === tab ? "#f59e0b" : "#5c3d1e",
        borderBottom: activeTab === tab ? "2px solid #f59e0b" : "2px solid transparent",
      }}
    >
      {label}
      {badge && (
        <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
      )}
    </button>
  )

  return (
    <div className="flex flex-col h-screen" style={{ background: "#1a1008" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "#3d2010", background: "#140a02" }}>
        <button onClick={() => router.push("/")}
          className="text-sm px-3 py-1 rounded-lg transition-colors"
          style={{ color: "#7a5c38", border: "1px solid #3d2010" }}>
          ← 场景
        </button>
        <Image src="/logo.png" alt="logo" width={30} height={30} className="rounded-lg shrink-0" />
        <span className="text-lg">{scenario.emoji}</span>
        <span className="font-bold" style={{ color: "#f59e0b", fontFamily: "serif" }}>{scenario.titleJa}</span>
        <span className="text-sm hidden sm:inline" style={{ color: "#7a5c38" }}>{scenario.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowRomaji(v => !v)}
            className="text-xs px-3 py-1 rounded-lg transition-all"
            style={{
              background: showRomaji ? "#f59e0b" : "#261508",
              color: showRomaji ? "#1a0c02" : "#a07850",
              border: `1px solid ${showRomaji ? "#f59e0b" : "#5c3010"}`,
              fontWeight: showRomaji ? 600 : 400,
            }}>
            ローマ字
          </button>
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1 rounded-lg transition-all"
            style={{
              background: "transparent",
              color: "#7a5c38",
              border: "1px solid #3d2010",
            }}
            title="清空此场景历史记录"
          >
            清空历史
          </button>
          <span className="text-xs px-2 py-0.5 rounded hidden sm:inline"
            style={{ background: "#261508", color: "#a07850", border: "1px solid #5c3010" }}>
            {scenario.difficulty} · {scenario.character.name}
          </span>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b shrink-0" style={{ borderColor: "#3d2010", background: "#1a0c02" }}>
        {tabBtn("dialog", "💬 对话")}
        {tabBtn("coach", "🧑‍🏫 教练", hasNewCoach)}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ background: "#3d0a0a", borderBottom: "1px solid #7a1a1a" }}>
          <span className="text-sm" style={{ color: "#fca5a5" }}>⚠ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs px-2 py-0.5 rounded"
            style={{ color: "#fca5a5", border: "1px solid #7a1a1a" }}>✕</button>
        </div>
      )}

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`${activeTab !== "dialog" ? "hidden md:flex md:flex-1" : "flex-1"} border-r overflow-hidden`}
          style={{ borderColor: "#3d2010" }}
        >
          <DialogPanel
            messages={dialogMessages}
            characterName={scenario.character.name}
            isStreaming={charStreaming}
            streamingText={charStreamText}
            showRomaji={showRomaji}
          />
        </div>
        <div className={`${activeTab !== "coach" ? "hidden md:flex md:flex-1" : "flex-1"} overflow-hidden`}>
          <CoachPanel
            messages={coachMessages}
            isStreaming={coachStreaming}
            streamingText={coachStreamText}
          />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0">
        <InputBar onSend={handleSend} onContinue={handleContinue} onReset={handleReset} disabled={isDisabled} />
      </div>
    </div>
  )
}
