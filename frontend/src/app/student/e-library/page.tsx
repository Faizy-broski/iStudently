'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getELibraryBooks } from '@/lib/api/library'
import { Book } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, BookOpen, BookText, Loader2 } from 'lucide-react'

export default function ELibraryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<Partial<Book>[]>([])
  const [filtered, setFiltered] = useState<Partial<Book>[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.access_token) return
    setLoading(true)
    getELibraryBooks(user.access_token).then((res) => {
      if (res.success && res.data) {
        setBooks(res.data)
        setFiltered(res.data)
      }
      setLoading(false)
    })
  }, [user?.access_token])

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(books)
      return
    }
    const q = query.toLowerCase()
    setFiltered(
      books.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.author?.toLowerCase().includes(q)
      )
    )
  }, [query, books])

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            E-Library
          </h1>
          <p className="text-muted-foreground">Browse and read digital books</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <BookText className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">
            {query ? 'No books match your search.' : 'No digital books are available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onRead={() => router.push(`/student/e-library/${book.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BookCard({
  book,
  onRead,
}: {
  book: Partial<Book>
  onRead: () => void
}) {
  // Generate initials-based gradient cover fallback
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
        className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border shadow-sm cursor-pointer transition-transform duration-200 group-hover:scale-[1.03] group-hover:shadow-md"
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
        {docTypeLabel && (
          <Badge className="absolute top-1.5 left-1.5 text-[9px] py-0 px-1.5 capitalize bg-black/60 text-white border-0 hover:bg-black/60">
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
