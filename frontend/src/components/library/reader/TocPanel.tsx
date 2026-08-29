'use client'

/**
 * Contents/Search/Bookmarks drawer for FlipbookReader — three tabs sharing one Sheet:
 * - Contents: the PDF's table of contents (pdf.js `getOutline()`), with a
 *   tree-preserving search filter (ancestor chapters stay visible when only
 *   a nested subsection matches).
 * - Search: full-text search across the whole document via useDocumentSearch,
 *   with progressive/batched results and a scan-progress indicator.
 * - Bookmarks: the reader's own saved bookmarks (state/persistence owned by
 *   FlipbookReader — this panel just renders the list and asks to delete/navigate).
 */

import { useEffect, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronRight, Search as SearchIcon, List as ListIcon, Bookmark as BookmarkIcon, Trash2 } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentSearch } from '@/lib/pdf/useDocumentSearch'
import { flattenOutline, filterOutlineTree, findChapterForPage, type TocTreeNode } from '@/lib/pdf/outline'
import type { Bookmark } from '@/lib/api/library'
import { cn } from '@/lib/utils'

interface TocPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  outlineTree: TocTreeNode[] | null
  pdfDocument: PDFDocumentProxy | null
  numPages: number
  onNavigate: (pageIndex: number) => void
  bookmarks: Bookmark[]
  onDeleteBookmark: (bookmarkId: string) => void
}

function TocTreeList({ nodes, onNavigate }: { nodes: TocTreeNode[]; onNavigate: (pageIndex: number) => void }) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            type="button"
            disabled={node.pageIndex === null}
            onClick={() => node.pageIndex !== null && onNavigate(node.pageIndex)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-default disabled:opacity-60',
            )}
            style={{ paddingInlineStart: `${node.depth * 16 + 8}px` }}
          >
            <span className="truncate">{node.title || 'Untitled'}</span>
            {node.pageIndex !== null && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">p.{node.pageIndex + 1}</span>
            )}
          </button>
          {node.children.length > 0 && <TocTreeList nodes={node.children} onNavigate={onNavigate} />}
        </li>
      ))}
    </ul>
  )
}

export function TocPanel({
  open,
  onOpenChange,
  outlineTree,
  pdfDocument,
  numPages,
  onNavigate,
  bookmarks,
  onDeleteBookmark,
}: TocPanelProps) {
  const [tab, setTab] = useState<'contents' | 'search' | 'bookmarks'>('contents')
  const [tocQuery, setTocQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)

  const { search, results, scanProgress, isSearching } = useDocumentSearch(pdfDocument, numPages)

  const flatOutline = useMemo(() => (outlineTree ? flattenOutline(outlineTree) : []), [outlineTree])
  const filteredTree = useMemo(
    () => (outlineTree ? filterOutlineTree(outlineTree, tocQuery) : []),
    [outlineTree, tocQuery]
  )

  useEffect(() => {
    if (tab === 'search' && debouncedSearchQuery.trim()) {
      search(debouncedSearchQuery)
    }
  }, [tab, debouncedSearchQuery, search])

  const handleNavigate = (pageIndex: number) => {
    onNavigate(pageIndex)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[22rem] sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Contents &amp; Search</SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'contents' | 'search' | 'bookmarks')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contents" className="gap-1.5">
              <ListIcon className="h-3.5 w-3.5" />
              Contents
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1.5">
              <SearchIcon className="h-3.5 w-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <BookmarkIcon className="h-3.5 w-3.5" />
              Bookmarks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contents" className="flex-1 flex flex-col min-h-0 mt-3">
            {outlineTree ? (
              <>
                <Input
                  placeholder="Filter chapters…"
                  value={tocQuery}
                  onChange={(e) => setTocQuery(e.target.value)}
                  className="mb-2"
                />
                <ScrollArea className="flex-1 -mx-1 px-1">
                  {filteredTree.length > 0 ? (
                    <TocTreeList nodes={filteredTree} onNavigate={handleNavigate} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No matching chapters.</p>
                  )}
                </ScrollArea>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                This book has no table of contents.
              </p>
            )}
          </TabsContent>

          <TabsContent value="search" className="flex-1 flex flex-col min-h-0 mt-3">
            <Input
              placeholder="Search this book…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
              autoFocus
            />
            {isSearching && (
              <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(scanProgress * 100)}%` }}
                />
              </div>
            )}
            <ScrollArea className="flex-1 -mx-1 px-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchQuery.trim() ? (isSearching ? 'Searching…' : 'No matches found.') : 'Type to search the full text of this book.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {results.map((r, i) => {
                    const chapter = findChapterForPage(flatOutline, r.pageIndex)
                    return (
                      <li key={`${r.pageIndex}-${r.matchStart}-${i}`}>
                        <button
                          type="button"
                          onClick={() => handleNavigate(r.pageIndex)}
                          className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left hover:bg-accent"
                        >
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {chapter && (
                              <>
                                <span className="truncate max-w-[14rem]">{chapter.breadcrumb.join(' › ')}</span>
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              </>
                            )}
                            <span className="tabular-nums shrink-0">p. {r.pageIndex + 1}</span>
                          </span>
                          <span className="text-sm">{r.snippet}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bookmarks" className="flex-1 flex flex-col min-h-0 mt-3">
            <ScrollArea className="flex-1 -mx-1 px-1">
              {bookmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bookmarks yet — use the bookmark button in the toolbar to save a page.
                </p>
              ) : (
                <ul className="space-y-1">
                  {bookmarks.map((b) => {
                    const chapter = findChapterForPage(flatOutline, b.pageIndex)
                    return (
                      <li key={b.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleNavigate(b.pageIndex)}
                          className="flex flex-1 flex-col items-start gap-0.5 rounded-sm px-2 py-2 text-left hover:bg-accent min-w-0"
                        >
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {chapter && (
                              <>
                                <span className="truncate max-w-48">{chapter.breadcrumb.join(' › ')}</span>
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              </>
                            )}
                            <span className="tabular-nums shrink-0">p. {b.pageIndex + 1}</span>
                          </span>
                          <span className="text-sm truncate w-full">{b.label || `Page ${b.pageIndex + 1}`}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          onClick={() => onDeleteBookmark(b.id)}
                          title="Remove bookmark"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
