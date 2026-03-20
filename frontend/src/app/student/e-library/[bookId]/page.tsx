'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getELibraryBooks } from '@/lib/api/library'
import { Book } from '@/types'
import { FlipbookReader } from '@/components/library/FlipbookReader'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

export default function ELibraryReaderPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const bookId = params?.bookId as string

  const [book, setBook] = useState<Partial<Book> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.access_token || !bookId) return
    setLoading(true)
    getELibraryBooks(user.access_token).then((res) => {
      if (res.success && res.data) {
        const found = res.data.find((b) => b.id === bookId)
        if (found && found.file_url) {
          setBook(found)
        } else {
          setError('Book not found or has no digital content.')
        }
      } else {
        setError(res.error || 'Failed to load book.')
      }
      setLoading(false)
    })
  }, [user?.access_token, bookId])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Top nav */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/student/e-library')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {book && (
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{book.title}</p>
            {book.author && (
              <p className="text-xs text-muted-foreground truncate">{book.author}</p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Opening book…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => router.push('/student/e-library')}>
              Back to E-Library
            </Button>
          </div>
        ) : book?.file_url ? (
          <FlipbookReader fileUrl={book.file_url} title={book.title ?? 'Book'} />
        ) : null}
      </div>
    </div>
  )
}
