'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getELibraryBooks } from '@/lib/api/library'
import { Book } from '@/types'
import { ELibraryContent } from '@/components/library/ELibraryContent'

export default function LibrarianELibraryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [books, setBooks] = useState<Partial<Book>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.access_token) return
    setLoading(true)
    getELibraryBooks(user.access_token).then((res) => {
      if (res.success && res.data) setBooks(res.data)
      setLoading(false)
    })
  }, [user?.access_token])

  return (
    <ELibraryContent
      books={books}
      loading={loading}
      onRead={(bookId) => router.push(`/librarian/e-library/${bookId}`)}
    />
  )
}
