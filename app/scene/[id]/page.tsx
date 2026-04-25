import { notFound } from "next/navigation"
import { getScenario } from "@/lib/scenarios"
import SceneClient from "./SceneClient"

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
