import { supabase } from '../config/supabase'

export interface ReadingProgress {
  bookId: string
  lastPageIndex: number
  totalPages: number | null
  updatedAt: string
}

export interface Bookmark {
  id: string
  bookId: string
  pageIndex: number
  label: string | null
  createdAt: string
}

class ElibraryReadingService {
  async getReadingProgress(schoolId: string, profileId: string, bookId: string): Promise<ReadingProgress | null> {
    const { data, error } = await supabase
      .from('elibrary_reading_progress')
      .select('book_id, last_page_index, total_pages, updated_at')
      .eq('school_id', schoolId)
      .eq('profile_id', profileId)
      .eq('book_id', bookId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch reading progress: ${error.message}`)
    if (!data) return null

    return {
      bookId: data.book_id,
      lastPageIndex: data.last_page_index,
      totalPages: data.total_pages,
      updatedAt: data.updated_at,
    }
  }

  async upsertReadingProgress(
    schoolId: string,
    profileId: string,
    bookId: string,
    lastPageIndex: number,
    totalPages?: number
  ): Promise<ReadingProgress> {
    const { data, error } = await supabase
      .from('elibrary_reading_progress')
      .upsert(
        {
          school_id: schoolId,
          profile_id: profileId,
          book_id: bookId,
          last_page_index: lastPageIndex,
          total_pages: totalPages ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,book_id' }
      )
      .select('book_id, last_page_index, total_pages, updated_at')
      .single()

    if (error) throw new Error(`Failed to save reading progress: ${error.message}`)

    return {
      bookId: data.book_id,
      lastPageIndex: data.last_page_index,
      totalPages: data.total_pages,
      updatedAt: data.updated_at,
    }
  }

  async listBookmarks(schoolId: string, profileId: string, bookId: string): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('elibrary_bookmarks')
      .select('id, book_id, page_index, label, created_at')
      .eq('school_id', schoolId)
      .eq('profile_id', profileId)
      .eq('book_id', bookId)
      .order('page_index', { ascending: true })

    if (error) throw new Error(`Failed to fetch bookmarks: ${error.message}`)

    return (data || []).map((row) => ({
      id: row.id,
      bookId: row.book_id,
      pageIndex: row.page_index,
      label: row.label,
      createdAt: row.created_at,
    }))
  }

  async createBookmark(
    schoolId: string,
    profileId: string,
    bookId: string,
    pageIndex: number,
    label?: string
  ): Promise<Bookmark> {
    const { data, error } = await supabase
      .from('elibrary_bookmarks')
      .insert({
        school_id: schoolId,
        profile_id: profileId,
        book_id: bookId,
        page_index: pageIndex,
        label: label ?? null,
      })
      .select('id, book_id, page_index, label, created_at')
      .single()

    if (error) throw new Error(`Failed to create bookmark: ${error.message}`)

    return {
      id: data.id,
      bookId: data.book_id,
      pageIndex: data.page_index,
      label: data.label,
      createdAt: data.created_at,
    }
  }

  async deleteBookmark(schoolId: string, profileId: string, bookmarkId: string): Promise<void> {
    const { error } = await supabase
      .from('elibrary_bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('school_id', schoolId)
      .eq('profile_id', profileId)

    if (error) throw new Error(`Failed to delete bookmark: ${error.message}`)
  }
}

export const elibraryReadingService = new ElibraryReadingService()
