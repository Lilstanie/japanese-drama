import { retrieve } from "@/lib/rag/index"

export async function POST(request: Request) {
  const { query, topK } = (await request.json()) as {
    query?: string
    topK?: number
  }

  const q = query?.trim()
  if (!q) {
    return Response.json({ error: "query is required" }, { status: 400 })
  }

  const k = Math.min(Math.max(topK ?? 4, 1), 8)
  const chunks = retrieve(q, k)

  return Response.json({
    query: q,
    topK: k,
    chunks,
    retriever: "tfidf" as const,
  })
}
