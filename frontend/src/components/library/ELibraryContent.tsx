'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, BookText, Loader2, Link2 } from 'lucide-react'
import { Book, LibraryCategory } from '@/types'
import { getCategories } from '@/lib/api/library'
import { useAuth } from '@/context/AuthContext'

interface ELibraryContentProps {
  books: Partial<Book>[]
  loading: boolean
  onRead: (bookId: string) => void
}

const MAX_FEATURED_CATEGORIES = 10

export function ELibraryContent({ books, loading, onRead }: ELibraryContentProps) {
  const [query, setQuery] = useState('')
  // Top-level category (own school's local ones, or a featured global one).
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  // A subcategory picked underneath the active top-level category, for narrowing further.
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null)
  const [dbCategories, setDbCategories] = useState<LibraryCategory[]>([])
  const { user } = useAuth()

  // Fetch actual categories from DB
  useEffect(() => {
    if (!user?.access_token) return
    getCategories(user.access_token).then((res) => {
      if (res.success && res.data) {
        // Sort by sort_order
        setDbCategories(res.data.sort((a, b) => a.sort_order - b.sort_order))
      }
    })
  }, [user?.access_token])

  // Main chip row: the school's own local top-level categories (uncapped) +
  // only the super-admin-featured global ones, so a large global category
  // list doesn't clutter every school's homepage. The 10-item cap is really
  // enforced server-side (library.service.ts); slicing here is just a
  // defensive mirror of that guarantee.
  const topLevelChips = useMemo(() => {
    const local = dbCategories.filter((c) => !c.parent_category_id && !c.is_global)
    const featuredGlobal = dbCategories
      .filter((c) => !c.parent_category_id && c.is_global && c.is_featured)
      .sort((a, b) => (a.featured_order ?? 0) - (b.featured_order ?? 0))
      .slice(0, MAX_FEATURED_CATEGORIES)
    return [...local, ...featuredGlobal].sort((a, b) => a.sort_order - b.sort_order)
  }, [dbCategories])

  const subcategoriesOfActive = useMemo(
    () => (activeCategoryId ? dbCategories.filter((c) => c.parent_category_id === activeCategoryId) : []),
    [dbCategories, activeCategoryId]
  )

  const selectTopLevel = (categoryId: string | null) => {
    setActiveCategoryId(categoryId)
    setActiveSubcategoryId(null)
  }

  const filtered = useMemo(() => {
    let list = books
    if (activeSubcategoryId) {
      list = list.filter((b) => b.category_id === activeSubcategoryId)
    } else if (activeCategoryId) {
      const childIds = subcategoriesOfActive.map((c) => c.id)
      list = list.filter((b) => b.category_id === activeCategoryId || (!!b.category_id && childIds.includes(b.category_id)))
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q)
      )
    }
    return list
  }, [books, activeCategoryId, activeSubcategoryId, subcategoriesOfActive, query])

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#022172] dark:text-white">
            E-Library
          </h1>
          <p className="text-sm text-muted-foreground">Browse and read digital books</p>
        </div>
      </div>

      {/* Search + Category Filters row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or author.."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex items-center p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 overflow-x-auto w-full md:w-auto shrink-0">
          {topLevelChips.map((cat) => {
            const isActive = activeCategoryId === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => selectTopLevel(isActive ? null : cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 border border-transparent font-normal'
                }`}
              >
                {isActive && <span>📚</span>}
                {cat.name}
                <Link2 className={`h-3.5 w-3.5 ${isActive ? 'opacity-60' : 'opacity-40'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Subcategory row — appears once a top-level category with children is active */}
      {activeCategoryId && subcategoriesOfActive.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubcategoryId(null)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-colors ${
              !activeSubcategoryId
                ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                : 'text-muted-foreground hover:bg-muted border-border'
            }`}
          >
            All in category
          </button>
          {subcategoriesOfActive.map((sub) => {
            const isActive = activeSubcategoryId === sub.id
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubcategoryId(isActive ? null : sub.id)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                    : 'text-muted-foreground hover:bg-muted border-border'
                }`}
              >
                {sub.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Active category label */}
      {activeCategoryId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing books in</span>
          <Badge variant="secondary" className="font-medium">
            {activeSubcategoryId
              ? subcategoriesOfActive.find(c => c.id === activeSubcategoryId)?.name
              : topLevelChips.find(c => c.id === activeCategoryId)?.name}
          </Badge>
          <span>·</span>
          <span>{filtered.length} book{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <BookText className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">
            {query || activeCategoryId
              ? 'No books match your filters.'
              : 'No digital books are available yet.'}
          </p>
          {(query || activeCategoryId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setQuery(''); selectTopLevel(null) }}
              className="text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onRead={() => onRead(book.id!)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BookCard({ book, onRead }: { book: Partial<Book>; onRead: () => void }) {
  const initials = (book.title ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  const docTypeLabel =
    book.document_type && book.document_type !== 'book'
      ? book.document_type
      : null

  return (
    <div className="group flex flex-col gap-2">
      {/* Cover */}
      <div
        className="relative w-full aspect-2/3 rounded-lg overflow-hidden border shadow-sm cursor-pointer transition-transform duration-200 group-hover:scale-[1.03] group-hover:shadow-md"
        onClick={onRead}
      >
        {book.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_image_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-[#57A3CC]/80 to-[#022172] flex flex-col items-center justify-center gap-2 p-3">
            <span className="text-3xl font-bold text-white/90 tracking-wide">{initials}</span>
            <BookOpen className="h-6 w-6 text-white/60" />
          </div>
        )}
        {/* Document type badge */}
        {docTypeLabel && (
          <Badge className="absolute top-2 left-2 text-[10px] py-0 px-2 capitalize bg-black/70 text-white border-0 hover:bg-black/70 rounded-full font-medium tracking-wide shadow-sm">
            {docTypeLabel}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="space-y-0.5 px-0.5">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{book.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
      </div>

      <Button
        size="sm"
        className="w-full bg-linear-to-r from-[#57A3CC] to-[#022172] text-white text-xs h-7"
        onClick={onRead}
      >
        Read
      </Button>
    </div>
  )
}
