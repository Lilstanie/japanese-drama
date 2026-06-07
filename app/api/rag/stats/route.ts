import { getRagStats } from "@/lib/rag/index"

export async function GET() {
  return Response.json(getRagStats())
}
