import type {
  DocumentChunkInsert,
  ParsedPdfPage,
} from '@/lib/documents/types'

const CHUNK_MAX_CHARACTERS = 1200
const CHUNK_OVERLAP_CHARACTERS = 150

function normalizeChunkText(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

function splitTextIntoWindows(value: string) {
  const normalized = normalizeChunkText(value)

  if (!normalized) {
    return []
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_MAX_CHARACTERS, normalized.length)

    if (end < normalized.length) {
      const breakIndex = normalized.lastIndexOf('\n', end)

      if (breakIndex > start + CHUNK_MAX_CHARACTERS / 2) {
        end = breakIndex
      }
    }

    const chunk = normalizeChunkText(normalized.slice(start, end))

    if (chunk) {
      chunks.push(chunk)
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(end - CHUNK_OVERLAP_CHARACTERS, start + 1)
  }

  return chunks
}

export function createPdfChunks(params: {
  documentId: string
  userId: string
  pages: ParsedPdfPage[]
}) {
  const chunks: DocumentChunkInsert[] = []
  let chunkIndex = 0

  for (const page of params.pages) {
    const pageWindows = splitTextIntoWindows(page.text)

    for (const windowText of pageWindows) {
      chunks.push({
        document_id: params.documentId,
        user_id: params.userId,
        chunk_index: chunkIndex,
        content: windowText,
        source_page: page.pageNumber,
        metadata: {
          source: 'pdf',
          page: page.pageNumber,
        },
        embedding: null,
      })
      chunkIndex += 1
    }
  }

  return chunks
}

export function createCsvChunks(params: {
  documentId: string
  userId: string
  rowBlocks: string[]
  headers: string[]
}) {
  return createTabularChunks({
    ...params,
    source: 'csv',
    sheetName: null,
  })
}

export function createTabularChunks(params: {
  documentId: string
  userId: string
  rowBlocks: string[]
  rowNumbers?: number[]
  headers: string[]
  source: 'csv' | 'xlsx'
  sheetName: string | null
  startingChunkIndex?: number
}) {
  const chunks: DocumentChunkInsert[] = []
  let currentChunkRows: string[] = []
  let currentLength = 0
  let rowStart = 1
  let chunkIndex = params.startingChunkIndex ?? 0

  params.rowBlocks.forEach((rowBlock, index) => {
    const separatorLength = currentChunkRows.length > 0 ? 2 : 0
    const nextLength = currentLength + rowBlock.length + separatorLength

    if (
      currentChunkRows.length > 0 &&
      nextLength > CHUNK_MAX_CHARACTERS
    ) {
      const content = currentChunkRows.join('\n\n')

      chunks.push({
        document_id: params.documentId,
        user_id: params.userId,
        chunk_index: chunkIndex,
        content,
        source_page: null,
        metadata: {
          source: params.source,
          sheetName: params.sheetName,
          rowStart: params.rowNumbers?.[rowStart - 1] ?? rowStart,
          rowEnd: params.rowNumbers?.[index - 1] ?? index,
          headers: params.headers,
        },
        embedding: null,
      })

      chunkIndex += 1
      currentChunkRows = [rowBlock]
      currentLength = rowBlock.length
      rowStart = index + 1
      return
    }

    currentChunkRows.push(rowBlock)
    currentLength = nextLength
  })

  if (currentChunkRows.length > 0) {
    chunks.push({
      document_id: params.documentId,
      user_id: params.userId,
      chunk_index: chunkIndex,
      content: currentChunkRows.join('\n\n'),
      source_page: null,
      metadata: {
        source: params.source,
        sheetName: params.sheetName,
        rowStart: params.rowNumbers?.[rowStart - 1] ?? rowStart,
        rowEnd:
          params.rowNumbers?.[params.rowBlocks.length - 1] ??
          params.rowBlocks.length,
        headers: params.headers,
      },
      embedding: null,
    })
  }

  return chunks
}
