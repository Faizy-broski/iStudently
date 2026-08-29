/**
 * Full-text search over a loaded pdf.js document.
 *
 * Extracts each page's text once (cached for the lifetime of the hook
 * instance), scans page-by-page, and publishes matches in batches so a long
 * book doesn't cause a re-render per hit. Accent-insensitive: both the
 * haystack and the query are folded (NFKD + strip combining marks) before
 * matching, with an index map back to the original (unfolded) text so
 * reported match ranges stay correct.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface SearchResult {
  pageIndex: number
  snippet: string
  matchStart: number
  matchEnd: number
}

const BATCH_PAGES = 20
const SNIPPET_RADIUS = 40

function buildFoldedText(original: string): { folded: string; indexMap: number[] } {
  const foldedChars: string[] = []
  const indexMap: number[] = []
  let i = 0
  for (const ch of original) {
    const decomposed = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    for (const dch of decomposed) {
      foldedChars.push(dch)
      indexMap.push(i)
    }
    i += ch.length
  }
  return { folded: foldedChars.join(''), indexMap }
}

function findFoldedMatches(original: string, query: string): Array<{ start: number; end: number }> {
  const { folded, indexMap } = buildFoldedText(original)
  const { folded: foldedQuery } = buildFoldedText(query)
  if (!foldedQuery) return []

  const matches: Array<{ start: number; end: number }> = []
  let from = 0
  while (from <= folded.length - foldedQuery.length) {
    const idx = folded.indexOf(foldedQuery, from)
    if (idx === -1) break
    const start = indexMap[idx]
    const end = indexMap[idx + foldedQuery.length] ?? original.length
    matches.push({ start, end })
    from = idx + foldedQuery.length
  }
  return matches
}

function buildSnippet(text: string, start: number, end: number): string {
  let from = Math.max(0, start - SNIPPET_RADIUS)
  let to = Math.min(text.length, end + SNIPPET_RADIUS)

  // Trim to the nearest word boundary so snippets don't start/end mid-word.
  const nextSpaceAfterFrom = text.indexOf(' ', from)
  if (nextSpaceAfterFrom !== -1 && nextSpaceAfterFrom < start) from = nextSpaceAfterFrom + 1
  const prevSpaceBeforeTo = text.lastIndexOf(' ', to)
  if (prevSpaceBeforeTo !== -1 && prevSpaceBeforeTo > end) to = prevSpaceBeforeTo

  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  return `${prefix}${text.slice(from, to)}${suffix}`
}

export function useDocumentSearch(pdfDocument: PDFDocumentProxy | null, numPages: number) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [scanProgress, setScanProgress] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

  const pageTextCache = useRef<Map<number, string>>(new Map())
  const runIdRef = useRef(0)
  const currentQueryRef = useRef<string | null>(null)

  const getPageText = useCallback(
    async (pageNumber: number): Promise<string> => {
      const cached = pageTextCache.current.get(pageNumber)
      if (cached !== undefined) return cached
      if (!pdfDocument) return ''
      const page = await pdfDocument.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      pageTextCache.current.set(pageNumber, text)
      return text
    },
    [pdfDocument]
  )

  const cancel = useCallback(() => {
    runIdRef.current += 1
    currentQueryRef.current = null
    setIsSearching(false)
  }, [])

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!pdfDocument || !trimmed) {
        setResults([])
        setScanProgress(0)
        setIsSearching(false)
        currentQueryRef.current = null
        return
      }

      // Dedup: an identical query is already the in-flight scan — nothing to do,
      // its progressive results are already flowing into `results`.
      if (currentQueryRef.current === trimmed && isSearching) return

      const runId = ++runIdRef.current
      currentQueryRef.current = trimmed
      setResults([])
      setScanProgress(0)
      setIsSearching(true)

      let buffer: SearchResult[] = []
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        if (runIdRef.current !== runId) return // cancelled or superseded by a newer search

        let text: string
        try {
          text = await getPageText(pageNumber)
        } catch {
          text = ''
        }

        const matches = findFoldedMatches(text, trimmed)
        for (const m of matches) {
          buffer.push({
            pageIndex: pageNumber - 1,
            snippet: buildSnippet(text, m.start, m.end),
            matchStart: m.start,
            matchEnd: m.end,
          })
        }

        if (pageNumber % BATCH_PAGES === 0 || pageNumber === numPages) {
          if (buffer.length > 0) {
            const toFlush = buffer
            buffer = []
            setResults((prev) => [...prev, ...toFlush])
          }
          setScanProgress(pageNumber / numPages)
        }
      }

      if (runIdRef.current === runId) {
        setIsSearching(false)
      }
    },
    [pdfDocument, numPages, getPageText, isSearching]
  )

  return useMemo(
    () => ({ search, results, scanProgress, isSearching, cancel }),
    [search, results, scanProgress, isSearching, cancel]
  )
}
