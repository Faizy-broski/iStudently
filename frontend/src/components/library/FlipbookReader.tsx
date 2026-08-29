'use client'

/**
 * FlipbookReader — 3D page-flip reader for PDFs and images.
 *
 * Architecture:
 * - PDFs: react-pdf renders each page onto a <canvas> (plus a real text layer
 *   for selection/copy and an annotation layer for links); those pages are
 *   fed as children into react-pageflip's <HTMLFlipBook> for the flip animation.
 * - Images: single-page "book" rendered directly inside <HTMLFlipBook>.
 * - react-pageflip is only imported on the client (dynamic import) to avoid SSR issues.
 * - Page sizing goes through resolveFit() (fit-by-width/height/whole-page + zoom),
 *   and reading direction is auto-detected (RTL/LTR) from the document's own text
 *   so Arabic/Hebrew books turn pages in the direction their readers expect.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  BookOpen,
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Languages,
  ListTree,
  Bookmark as BookmarkIcon,
} from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { resolveFit, clampZoom, ZOOM_STEP, ZOOM_MIN, type FitPolicy } from '@/lib/pdf/readingLayout'
import { detectDocumentDirectionCached, type TextDirection } from '@/lib/pdf/detectTextDirection'
import { getOutlineTree, type TocTreeNode } from '@/lib/pdf/outline'
import { TocPanel } from '@/components/library/reader/TocPanel'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  getReadingProgress,
  updateReadingProgress,
  getBookmarks,
  createBookmark,
  deleteBookmark,
  type Bookmark,
} from '@/lib/api/library'

// Configure pdf.js worker (shipped with react-pdf v9+)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// react-pageflip ships a default export; named export resolves to undefined in some bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlipBookType = React.ComponentType<Record<string, unknown> & { ref?: React.Ref<any> }>
const HTMLFlipBook = dynamic<Record<string, unknown>>(
  () => import('react-pageflip').then((mod) => (mod.HTMLFlipBook ?? mod.default) as FlipBookType),
  { ssr: false, loading: () => null }
)

// ---------------------------------------------------------------------------

interface FlipbookReaderProps {
  fileUrl: string
  title: string
  /** Show a Download button in the toolbar (admin-only by default — pass explicitly). */
  allowDownload?: boolean
  /** Library book id + auth token — when both are provided, resume-reading-progress and bookmarks are enabled. */
  bookId?: string
  token?: string
}

function detectFileType(url: string): 'pdf' | 'image' {
  const lower = url.split('?')[0].toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  return 'image'
}

const FIT_POLICY_LABELS: Record<FitPolicy, string> = {
  whole: 'Whole page',
  width: 'Fit width',
  height: 'Fit height',
}

// ---------------------------------------------------------------------------

export function FlipbookReader({ fileUrl, title, allowDownload = false, bookId, token }: FlipbookReaderProps) {
  const fileType = detectFileType(fileUrl)

  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(0)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 400, height: 560 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'flipbook' | 'pdf'>('flipbook')

  // Fit / zoom
  const [fitPolicy, setFitPolicy] = useState<FitPolicy>('whole')
  const [zoom, setZoom] = useState<number>(1)
  const [zoomLocked, setZoomLocked] = useState(false)
  const [pageNativeSize, setPageNativeSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  // Reading direction
  const [textDirection, setTextDirection] = useState<TextDirection>('unknown')
  const [directionOverride, setDirectionOverride] = useState<'ltr' | 'rtl' | null>(null)

  const effectiveDirection: 'ltr' | 'rtl' = directionOverride ?? (textDirection === 'unknown' ? 'ltr' : textDirection)
  const isRtl = effectiveDirection === 'rtl'

  // Table of contents / search panel
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [outlineTree, setOutlineTree] = useState<TocTreeNode[] | null>(null)
  const [tocPanelOpen, setTocPanelOpen] = useState(false)

  // Resume-reading-progress + bookmarks (enabled when bookId + token are provided)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const initialProgressAppliedRef = useRef(false)

  const downloadButton = allowDownload ? (
    <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
      <Button variant="ghost" size="icon" title="Download">
        <Download className="h-4 w-4" />
      </Button>
    </a>
  ) : null

  const flipBookRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Responsive container size (width/height budget available for the page)
  useEffect(() => {
    function updateSize() {
      if (!containerRef.current) return
      const containerW = containerRef.current.clientWidth
      const availableH = isFullscreen
        ? window.innerHeight - 220
        : Math.min(window.innerHeight - 320, 720)
      setContainerSize({ width: containerW, height: Math.max(200, availableH) })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', updateSize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [isFullscreen])

  const flipNext = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipNext()
  }, [])

  const flipPrev = useCallback(() => {
    flipBookRef.current?.pageFlip()?.flipPrev()
  }, [])

  const adjustZoom = useCallback((delta: number) => {
    setZoom((z) => clampZoom(z + delta))
  }, [])

  // Keyboard navigation + zoom. Left/Right are bound to screen position, not
  // "next/prev" — which action each side triggers depends on reading direction
  // (see the nav-button rendering below for the same left/right-slot logic).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (isRtl) flipPrev()
        else flipNext()
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (isRtl) flipNext()
        else flipPrev()
      }
      if ((e.key === '+' || e.key === '=') && !zoomLocked) adjustZoom(ZOOM_STEP)
      if (e.key === '-' && !zoomLocked) adjustZoom(-ZOOM_STEP)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flipNext, flipPrev, isRtl, zoomLocked, adjustZoom])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      if (zoomLocked) return
      adjustZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    },
    [zoomLocked, adjustZoom]
  )

  const onFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data)
  }, [])

  const onDocumentLoadSuccess = useCallback(
    (pdf: PDFDocumentProxy) => {
      setNumPages(pdf.numPages)
      setPdfLoading(false)
      setPdfDocument(pdf)

      pdf
        .getPage(1)
        .then((page) => {
          const viewport = page.getViewport({ scale: 1 })
          setPageNativeSize({ width: viewport.width, height: viewport.height })
        })
        .catch(() => {})

      detectDocumentDirectionCached(fileUrl, pdf, pdf.numPages)
        .then((result) => setTextDirection(result.direction))
        .catch(() => setTextDirection('unknown'))

      getOutlineTree(pdf)
        .then(setOutlineTree)
        .catch(() => setOutlineTree(null))
    },
    [fileUrl]
  )

  const navigateToPage = useCallback((pageIndex: number) => {
    flipBookRef.current?.pageFlip()?.flip(pageIndex)
  }, [])

  // Load saved progress + bookmarks once the flipbook is ready, and jump to
  // the last-read page. Runs once per book (guarded by the ref, since
  // navigateToPage below would otherwise keep re-triggering as currentPage changes).
  useEffect(() => {
    if (!bookId || !token || pdfLoading || numPages === 0 || initialProgressAppliedRef.current) return
    initialProgressAppliedRef.current = true

    getReadingProgress(bookId, token)
      .then((res) => {
        if (res.success && res.data && res.data.lastPageIndex > 0) {
          navigateToPage(res.data.lastPageIndex)
        }
      })
      .catch(() => {})

    getBookmarks(bookId, token)
      .then((res) => {
        if (res.success && res.data) setBookmarks(res.data)
      })
      .catch(() => {})
  }, [bookId, token, pdfLoading, numPages, navigateToPage])

  // Debounced save of reading progress on page turns (skips the initial
  // load-and-jump above so it never overwrites saved progress with page 0).
  const debouncedPage = useDebouncedValue(currentPage, 2500)
  useEffect(() => {
    if (!bookId || !token || !initialProgressAppliedRef.current || numPages === 0) return
    updateReadingProgress(bookId, { lastPageIndex: debouncedPage, totalPages: numPages }, token).catch(() => {})
  }, [debouncedPage, bookId, token, numPages])

  const currentBookmark = bookmarks.find((b) => b.pageIndex === currentPage) ?? null

  const toggleBookmark = useCallback(() => {
    if (!bookId || !token) return
    if (currentBookmark) {
      const id = currentBookmark.id
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      deleteBookmark(id, token).catch(() => {
        // Roll back on failure
        setBookmarks((prev) => [...prev, currentBookmark])
      })
    } else {
      const optimistic: Bookmark = {
        id: `pending-${currentPage}`,
        bookId,
        pageIndex: currentPage,
        label: null,
        createdAt: new Date().toISOString(),
      }
      setBookmarks((prev) => [...prev, optimistic])
      createBookmark(bookId, { pageIndex: currentPage }, token)
        .then((res) => {
          if (res.success && res.data) {
            setBookmarks((prev) => prev.map((b) => (b.id === optimistic.id ? res.data! : b)))
          } else {
            setBookmarks((prev) => prev.filter((b) => b.id !== optimistic.id))
          }
        })
        .catch(() => setBookmarks((prev) => prev.filter((b) => b.id !== optimistic.id)))
    }
  }, [bookId, token, currentBookmark, currentPage])

  const handleDeleteBookmark = useCallback(
    (bookmarkId: string) => {
      if (!token) return
      const removed = bookmarks.find((b) => b.id === bookmarkId)
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
      deleteBookmark(bookmarkId, token).catch(() => {
        if (removed) setBookmarks((prev) => [...prev, removed])
      })
    },
    [token, bookmarks]
  )

  const toggleFullscreen = () => setIsFullscreen((v) => !v)

  const cycleDirectionOverride = () => {
    setDirectionOverride((current) => {
      if (current === null) return 'ltr'
      if (current === 'ltr') return 'rtl'
      return null
    })
  }

  const directionLabel =
    directionOverride === 'ltr'
      ? 'LTR (forced)'
      : directionOverride === 'rtl'
        ? 'RTL (forced)'
        : textDirection === 'unknown'
          ? 'Auto (LTR)'
          : `Auto (${textDirection.toUpperCase()})`

  // -------------------------------------------------------------------------
  // Plain viewer — normal browser PDF rendering (user-selected), image files,
  // or a fallback if the PDF fails to parse for the flipbook.
  // -------------------------------------------------------------------------
  if (pdfError || fileType === 'image' || (fileType === 'pdf' && viewMode === 'pdf')) {
    const isSingleImage = fileType === 'image'
    return (
      <div
        ref={containerRef}
        className={`flex flex-col items-center gap-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-4' : ''}`}
      >
        <div className="flex items-center justify-between w-full max-w-3xl">
          <p className="text-sm text-muted-foreground font-medium truncate">{title}</p>
          <div className="flex items-center gap-1">
            {fileType === 'pdf' && !pdfError && (
              <Button variant="ghost" size="icon" onClick={() => setViewMode('flipbook')} title="Flipbook view">
                <BookOpen className="h-4 w-4" />
              </Button>
            )}
            {downloadButton}
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
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
  const isTwoPage = containerSize.width >= 768
  const perPageContainerWidth = isTwoPage
    ? Math.min(Math.floor((containerSize.width - 48) / 2), 500)
    : Math.min(containerSize.width - 32, 420)

  const { renderWidth: pageWidth, renderHeight: pageHeight } = resolveFit({
    fitPolicy,
    containerWidth: perPageContainerWidth,
    containerHeight: containerSize.height,
    pageNativeWidth: pageNativeSize.width,
    pageNativeHeight: pageNativeSize.height,
    zoom,
  })

  const flipbookWidth = isTwoPage ? pageWidth * 2 + 4 : pageWidth + 4
  const isZoomed = zoom > ZOOM_MIN

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center gap-6 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-neutral-900 overflow-auto py-8 px-4'
          : isZoomed
            ? 'overflow-auto max-h-[85vh]'
            : ''
      }`}
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-4xl px-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground truncate max-w-xs">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Select value={fitPolicy} onValueChange={(v) => setFitPolicy(v as FitPolicy)}>
            <SelectTrigger className="h-8 w-38 text-xs" title="Page fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FIT_POLICY_LABELS) as FitPolicy[]).map((policy) => (
                <SelectItem key={policy} value={policy}>
                  {FIT_POLICY_LABELS[policy]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" onClick={() => adjustZoom(-ZOOM_STEP)} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={() => adjustZoom(ZOOM_STEP)} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomLocked((v) => !v)}
            title={zoomLocked ? 'Zoom locked (click to unlock)' : 'Lock zoom'}
          >
            {zoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="sm" onClick={cycleDirectionOverride} title="Reading direction" className="gap-1 text-xs">
            <Languages className="h-4 w-4" />
            {directionLabel}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => setTocPanelOpen(true)} title="Contents & search">
            <ListTree className="h-4 w-4" />
          </Button>

          {bookId && token && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBookmark}
              title={currentBookmark ? 'Remove bookmark' : 'Bookmark this page'}
            >
              <BookmarkIcon className="h-4 w-4" fill={currentBookmark ? 'currentColor' : 'none'} />
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={() => setViewMode('pdf')} title="Normal PDF view">
            <FileText className="h-4 w-4" />
          </Button>
          {downloadButton}
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
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
        onWheel={onWheel}
        style={{
          width: flipbookWidth,
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
              useMouseEvents={false}
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i}
                  className="bg-white select-text"
                  style={{ width: pageWidth, height: pageHeight }}
                >
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth}
                    renderAnnotationLayer
                    renderTextLayer
                  />
                </div>
              ))}
            </HTMLFlipBook>
          )}
        </Document>
      </div>

      {/* Controls — screen position is fixed (left/right), but which action
          each slot performs flips with reading direction so "forward" always
          matches the physical side a reader of that direction expects. */}
      {!pdfLoading && numPages > 0 && (
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={isRtl ? flipNext : flipPrev}
            disabled={isRtl ? currentPage >= numPages - 1 : currentPage === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {isRtl ? 'Next' : 'Prev'}
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            Page {currentPage + 1} / {numPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={isRtl ? flipPrev : flipNext}
            disabled={isRtl ? currentPage === 0 : currentPage >= numPages - 1}
            className="gap-1"
          >
            {isRtl ? 'Prev' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <TocPanel
        open={tocPanelOpen}
        onOpenChange={setTocPanelOpen}
        outlineTree={outlineTree}
        pdfDocument={pdfDocument}
        numPages={numPages}
        onNavigate={navigateToPage}
        bookmarks={bookmarks}
        onDeleteBookmark={handleDeleteBookmark}
      />
    </div>
  )
}
