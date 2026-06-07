import type { RagChunk, RagDocument } from "./types"

const CHUNK_SIZE = 280
const CHUNK_OVERLAP = 60

export function chunkDocuments(documents: RagDocument[]): RagChunk[] {
  const chunks: RagChunk[] = []

  for (const doc of documents) {
    const paragraphs = doc.content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)

    let buffer = ""
    let chunkIndex = 0

    const flush = () => {
      const text = buffer.trim()
      if (!text) return
      chunks.push({
        id: `${doc.id}#${chunkIndex}`,
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        text,
        chunkIndex,
      })
      chunkIndex += 1
      buffer = text.length > CHUNK_OVERLAP ? text.slice(-CHUNK_OVERLAP) : ""
    }

    for (const para of paragraphs) {
      if (!buffer) {
        buffer = para
      } else if (buffer.length + 1 + para.length <= CHUNK_SIZE) {
        buffer = `${buffer}\n${para}`
      } else {
        flush()
        buffer = buffer ? `${buffer}\n${para}` : para
      }

      while (buffer.length > CHUNK_SIZE) {
        const slice = buffer.slice(0, CHUNK_SIZE)
        chunks.push({
          id: `${doc.id}#${chunkIndex}`,
          documentId: doc.id,
          documentTitle: doc.title,
          category: doc.category,
          text: slice.trim(),
          chunkIndex,
        })
        chunkIndex += 1
        buffer = buffer.slice(CHUNK_SIZE - CHUNK_OVERLAP)
      }
    }

    if (buffer.trim()) {
      const text = buffer.trim()
      chunks.push({
        id: `${doc.id}#${chunkIndex}`,
        documentId: doc.id,
        documentTitle: doc.title,
        category: doc.category,
        text,
        chunkIndex,
      })
    }
  }

  return chunks
}
