export type RagDocument = {
  id: string
  title: string
  category: string
  content: string
}

export type RagChunk = {
  id: string
  documentId: string
  documentTitle: string
  category: string
  text: string
  chunkIndex: number
}

export type RetrievedChunk = RagChunk & {
  score: number
  rank: number
}

export type RagIndexStats = {
  documentCount: number
  chunkCount: number
  categories: string[]
  retriever: "tfidf"
}
