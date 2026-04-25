import SceneSelector from "@/components/SceneSelector"
import { SCENARIOS } from "@/lib/scenarios"

export default function Home() {
  return <SceneSelector scenarios={SCENARIOS} />
}
