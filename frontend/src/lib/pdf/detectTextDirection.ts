/**
 * Sampled-page RTL/LTR detection for a loaded pdf.js document.
 *
 * Samples the first few pages plus the middle and last page (most books
 * are consistent in reading direction throughout, so a full scan isn't
 * needed), classifies characters via Unicode script ranges, and only
 * commits to a direction when there's enough signal and enough of a
 * majority — otherwise reports 'unknown' rather than guessing.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'

export type TextDirection = 'ltr' | 'rtl' | 'unknown'

export interface DetectDirectionResult {
  direction: TextDirection
  confidence: number
}

const MAX_SAMPLE_PAGES = 8
const MAX_STRONG_CHARS = 500
const MIN_STRONG_CHARS = 24
const CONFIDENCE_THRESHOLD = 0.6

// Hebrew (U+0590-05FF), Arabic + Arabic Supplement (U+0600-06FF, U+0750-077F),
// Arabic Presentation Forms A (U+FB50-FDFF) and B (U+FE70-FEFF).
const RTL_RANGE = /[֐-׿؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/
// Basic Latin + Latin-1 Supplement + Latin Extended-A/B letters.
const LTR_RANGE = /[A-Za-zÀ-ɏ]/

function classify(char: string): 'rtl' | 'ltr' | null {
  if (RTL_RANGE.test(char)) return 'rtl'
  if (LTR_RANGE.test(char)) return 'ltr'
  return null
}

function samplePageNumbers(numPages: number): number[] {
  if (numPages <= 0) return []
  const pages = new Set<number>()
  const firstCount = Math.min(MAX_SAMPLE_PAGES, numPages)
  for (let i = 1; i <= firstCount; i++) pages.add(i)
  pages.add(Math.ceil(numPages / 2))
  pages.add(numPages)
  return Array.from(pages)
}

async function getPageText(pdfDocument: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber)
  const textContent = await page.getTextContent()
  return textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ')
}

export async function detectDocumentDirection(
  pdfDocument: PDFDocumentProxy,
  numPages: number
): Promise<DetectDirectionResult> {
  let rtlCount = 0
  let ltrCount = 0

  for (const pageNumber of samplePageNumbers(numPages)) {
    if (rtlCount + ltrCount >= MAX_STRONG_CHARS) break

    let text: string
    try {
      text = await getPageText(pdfDocument, pageNumber)
    } catch {
      continue
    }

    for (const char of text) {
      const cls = classify(char)
      if (cls === 'rtl') rtlCount++
      else if (cls === 'ltr') ltrCount++
      if (rtlCount + ltrCount >= MAX_STRONG_CHARS) break
    }
  }

  const total = rtlCount + ltrCount
  if (total < MIN_STRONG_CHARS) {
    return { direction: 'unknown', confidence: 0 }
  }

  const majority = Math.max(rtlCount, ltrCount)
  const confidence = majority / total
  if (confidence < CONFIDENCE_THRESHOLD) {
    return { direction: 'unknown', confidence }
  }

  return { direction: rtlCount > ltrCount ? 'rtl' : 'ltr', confidence }
}

// In-memory cache so reopening the same book in one session doesn't rescan.
const directionCache = new Map<string, DetectDirectionResult>()

export async function detectDocumentDirectionCached(
  cacheKey: string,
  pdfDocument: PDFDocumentProxy,
  numPages: number
): Promise<DetectDirectionResult> {
  const cached = directionCache.get(cacheKey)
  if (cached) return cached
  const result = await detectDocumentDirection(pdfDocument, numPages)
  directionCache.set(cacheKey, result)
  return result
}
