export type MessageRole = "character" | "user" | "coach"

export type Message = {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
}

export type ConversationState = {
  scenarioId: string
  dialogMessages: Message[]
  coachMessages: Message[]
}

export type Scenario = {
  id: string
  title: string
  titleJa: string
  emoji: string
  description: string
  character: { name: string; role: string }
  opening: string
  difficulty: string
  /** Optional beginner quick-reply phrases, shown as tappable chips before the
   *  learner has said anything so they are never stuck facing a blank box. */
  starters?: string[]
}
