'use client'

/**
 * FlipbookReader — 3D page-flip reader for PDFs and images.
 *
 * Architecture:
 * - PDFs: react-pdf renders each page onto a <canvas>; those canvases are
 *   fed as children into react-pageflip's <HTMLFlipBook> for the flip animation.
 * - Images: single-page "book" rendered directly inside <HTMLFlipBook>.
 * - react-pageflip is only imported on the client (dynamic import) to avoid SSR issues.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, BookOpen } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure pdf.js worker (shipped with react-pdf v9+)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// Dynamically import HTMLFlipBook — it uses browser APIs not available in SSR
const HTMLFlipBook = dynamic(
  () => import('react-pageflip').then((mod) => mod.HTMLFlipBook as any),
  { ssr: false, loading: () => null }
)

// ---------------------------------------------------------------------------

interface FlipbookReaderProps {
  fileUrl: string
  title: string
}

function detectFileType(url: string): 'pdf' | 'image' {
  const lower = url.split('?')[0].toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  return 'image'
}

// ---------------------------------------------------------------------------

export function FlipbookReader({ fileUrl, title }: FlipbookReaderProps) {
  const fileType = detectFileType(fileUrl)

  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [pageWidth, setPageWidth] = useState<number>(400)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(true)

  const flipBookRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive page width
  useEffect(() => {
    function updateWidth() {
      if (!containerRef.current) return
      const containerW = containerRef.current.clientWidth
      // Two-page spread on desktop (≥768px), single page on mobile
      const isTwoPage = containerW >= 768
      const newWidth = isTwoPage
        ? Math.min(Math.floor((containerW - 48) / 2), 500)
        : Math.min(containerW - 32, 420)
      setPageWidth(newWidth)
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [isFullscreen])

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') flipNext()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') flipPrev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const flipNext = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipNext()
  }, [])

  const flipPrev = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipPrev()
  }, [])

  const onFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data)
  }, [])

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPdfLoading(false)
  }, [])

  const toggleFullscreen = () => setIsFullscreen((v) => !v)

  // Page height derived from A4 ratio
  const pageHeight = Math.round(pageWidth * 1.414)

  // -------------------------------------------------------------------------
  // Fallback — if PDF fails to parse, show an embedded iframe
  // -------------------------------------------------------------------------
  if (pdfError || fileType === 'image') {
    const isSingleImage = fileType === 'image'
    return (
      <div
        ref={containerRef}
        className={`flex flex-col items-center gap-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-4' : ''}`}
      >
        <div className="flex items-center justify-between w-full max-w-3xl">
          <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        {isSingleImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={title} className="max-w-full max-h-[80vh] object-contain rounded shadow-lg" />
        ) : (
          <iframe
            src={fileUrl}
            title={title}
            className="w-full max-w-3xl rounded border shadow"
            style={{ height: isFullscreen ? 'calc(100vh - 80px)' : '75vh' }}
          />
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main flipbook (PDF)
  // -------------------------------------------------------------------------
  const isTwoPage = pageWidth < 490 // single page if narrow

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center gap-6 select-none ${
        isFullscreen ? 'fixed inset-0 z-50 bg-neutral-900 overflow-auto py-8 px-4' : ''
      }`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between w-full max-w-4xl px-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground truncate max-w-xs">{title}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle fullscreen">
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Loading state */}
      {pdfLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading book…</span>
        </div>
      )}

      {/* Flipbook */}
      <div
        className="relative"
        style={{
          width: isTwoPage ? pageWidth * 2 + 4 : pageWidth + 4,
          // Reserve height even while loading to avoid layout jump
          minHeight: pdfLoading ? pageHeight : undefined,
        }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => { setPdfError(true); setPdfLoading(false) }}
          loading={null}
        >
          {!pdfLoading && numPages > 0 && (
            <HTMLFlipBook
              ref={flipBookRef}
              width={pageWidth}
              height={pageHeight}
              size="fixed"
              minWidth={100}
              maxWidth={pageWidth}
              minHeight={200}
              maxHeight={pageHeight}
              showCover={false}
              mobileScrollSupport
              onFlip={onFlip}
              className="shadow-2xl"
              style={{}}
              startPage={0}
              drawShadow
              flippingTime={700}
              usePortrait={isTwoPage ? false : true}
              startZIndex={0}
              autoSize={false}
              clickEventForward
              useMouseEvents
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i}
                  className="bg-white"
                  style={{ width: pageWidth, height: pageHeight }}
                >
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </div>
              ))}
            </HTMLFlipBook>
          )}
        </Document>
      </div>

      {/* Controls */}
      {!pdfLoading && numPages > 0 && (
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={flipPrev}
            disabled={currentPage === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            Page {currentPage + 1} / {numPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={flipNext}
            disabled={currentPage >= numPages - 1}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
