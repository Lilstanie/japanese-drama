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
  character: { name: string; role: string; role_en?: string }
  opening: string
  difficulty: string
  /** English UI variants, used when the app language is set to English. */
  title_en?: string
  description_en?: string
  /** Optional beginner quick-reply phrases, shown as tappable chips before the
   *  learner has said anything so they are never stuck facing a blank box. */
  starters?: string[]
}
