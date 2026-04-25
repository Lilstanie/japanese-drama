"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import DialogPanel from "@/components/DialogPanel"
import CoachPanel from "@/components/CoachPanel"
import InputBar from "@/components/InputBar"
import type { Message, Scenario } from "@/lib/types"

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
  if (!res.ok || !res.body) throw new Error("Request failed")

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

  const isDisabled = charStreaming || coachStreaming

  async function runCoach(
    characterLine: string,
    currentDialog: Message[],
    isDirectQuestion = false,
    question = ""
  ) {
    setCoachStreaming(true)
    setCoachStreamText("")
    try {
      const full = await streamResponse(
        "/api/coach",
        isDirectQuestion
          ? { isDirectQuestion: true, question, dialogMessages: currentDialog }
          : { characterLine, dialogMessages: currentDialog },
        setCoachStreamText
      )
      setCoachMessages((prev) => [
        ...prev,
        { id: makeId(), role: "coach", content: full, timestamp: new Date() },
      ])
    } finally {
      setCoachStreaming(false)
      setCoachStreamText("")
    }
  }

  async function handleSend(input: string) {
    if (input.startsWith("@教练")) {
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
    }
  }

  async function handleContinue() {
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
    }
  }

  function handleReset() {
    setDialogMessages([{ id: makeId(), role: "character", content: scenario.opening, timestamp: new Date() }])
    setCoachMessages([])
    setCharStreamText("")
    setCoachStreamText("")
  }

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
        <span className="text-lg">{scenario.emoji}</span>
        <span className="font-bold" style={{ color: "#f59e0b", fontFamily: "serif" }}>{scenario.titleJa}</span>
        <span className="text-sm" style={{ color: "#7a5c38" }}>{scenario.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowRomaji(v => !v)}
            className="text-xs px-3 py-1 rounded-lg transition-all"
            style={{
              background: showRomaji ? "#f59e0b" : "#261508",
              color: showRomaji ? "#1a0c02" : "#a07850",
              border: `1px solid ${showRomaji ? "#f59e0b" : "#5c3010"}`,
              fontWeight: showRomaji ? 600 : 400,
            }}>
            ローマ字 {showRomaji ? "ON" : "OFF"}
          </button>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ background: "#261508", color: "#a07850", border: "1px solid #5c3010" }}>
            {scenario.difficulty} · {scenario.character.name}
          </span>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 border-r overflow-hidden" style={{ borderColor: "#3d2010" }}>
          <DialogPanel messages={dialogMessages} characterName={scenario.character.name}
            isStreaming={charStreaming} streamingText={charStreamText} showRomaji={showRomaji} />
        </div>
        <div className="flex-1 overflow-hidden">
          <CoachPanel messages={coachMessages} isStreaming={coachStreaming} streamingText={coachStreamText} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0">
        <InputBar onSend={handleSend} onContinue={handleContinue} onReset={handleReset} disabled={isDisabled} />
      </div>
    </div>
  )
}
