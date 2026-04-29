import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getScenario } from "@/lib/scenarios"
import SceneClient from "./SceneClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const scenario = getScenario(id)
  if (!scenario) return {}
  return {
    title: `${scenario.emoji} ${scenario.titleJa} — 日本語ドラマ`,
    description: scenario.description,
  }
}

export default async function ScenePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const scenario = getScenario(id)
  if (!scenario) notFound()
  return <SceneClient scenario={scenario} />
}
