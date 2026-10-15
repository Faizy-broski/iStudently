// Library: books/documents, copies, loans, fines, categories, document fields, stats.
// Same endpoints as frontend/src/lib/api/library.ts; router: library.routes.ts. The server scopes
// everything to the caller's school (campus for staff); no campus id is sent, like the web.
import type { Book, BookCopy, BookLoan, LibraryCategory, LibraryDocumentField, LibraryFine } from '@studently/shared-types'

import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface LibraryStudentHit {
  id: string
  first_name: string
  last_name: string
  admission_number: string
  class_name: string
  email?: string
  phone?: string
}

export interface ReadingProgress {
  bookId: string
  lastPageIndex: number
  totalPages: number | null
  updatedAt: string
}

export interface ReadingBookmark {
  id: string
  bookId: string
  pageIndex: number
  label: string | null
  createdAt: string
}

export interface LibraryStats {
  total_books: number
  total_copies: number
  available_copies: number
  issued_copies: number
  active_loans: number
  overdue_loans: number
  total_fines_collected: number
  pending_fines: number
  lost_copies?: number
  recent_loans?: { id: string; book_title: string; issue_date: string; due_date: string; status: string }[]
  overdue_list?: { id: string; book_title: string; student_name: string; due_date: string; days_overdue: number }[]
}

/** A loan as GET /library/loans returns it (joined display fields). */
export interface LibraryLoanRow extends BookLoan {
  student_number?: string
}

export interface LibraryFineStats {
  total_overdue_fines: number
  total_condition_fines: number
  unpaid_overdue_fines: number
  paid_overdue_fines: number
  overdue_fines_count: number
  recent_fines: { id: string; student_name: string; book_title: string; amount: number; type: 'overdue' | 'condition'; paid: boolean; created_at: string }[]
}

export interface LoansBreakdown {
  chart_data: Record<string, string | number>[]
  categories: { name: string; color: string }[]
  total_loans: number
}

export function adminLibraryApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    books: () => api.get<Book[]>('/library/books'),
    book: (bookId: string) => api.get<Book>(`/library/books/${id(bookId)}`),
    createBook: (body: Partial<Book>) => api.post<Book>('/library/books', body),
    updateBook: (bookId: string, body: Partial<Book>) => api.put<Book>(`/library/books/${id(bookId)}`, body),
    deleteBook: (bookId: string) => api.del<void>(`/library/books/${id(bookId)}`),
    eLibrary: () => api.get<Partial<Book>[]>('/library/e-library'),
    /** Reader state of the signed-in user (0-based page index). */
    progress: (bookId: string) => api.get<ReadingProgress | null>(`/library/e-library/${id(bookId)}/progress`),
    saveProgress: (bookId: string, body: { lastPageIndex: number; totalPages?: number }) => api.put<ReadingProgress>(`/library/e-library/${id(bookId)}/progress`, body),
    bookmarks: (bookId: string) => api.get<ReadingBookmark[]>(`/library/e-library/${id(bookId)}/bookmarks`),
    addBookmark: (bookId: string, body: { pageIndex: number; label?: string }) => api.post<ReadingBookmark>(`/library/e-library/${id(bookId)}/bookmarks`, body),
    deleteBookmark: (bookmarkId: string) => api.del<void>(`/library/e-library/bookmarks/${id(bookmarkId)}`),

    copies: (bookId: string) => api.get<BookCopy[]>(`/library/books/${id(bookId)}/copies`),
    availableCopies: (bookId: string) => api.get<BookCopy[]>(`/library/books/${id(bookId)}/copies/available`),
    addCopies: (bookId: string, body: { numberOfCopies: number; purchase_date?: string; price?: number; condition_notes?: string }) =>
      api.post<BookCopy[]>(`/library/books/${id(bookId)}/copies`, body),
    updateCopy: (copyId: string, body: Partial<Pick<BookCopy, 'status' | 'price' | 'condition_notes'>>) => api.put<BookCopy>(`/library/copies/${id(copyId)}`, body),
    deleteCopy: (copyId: string) => api.del<void>(`/library/copies/${id(copyId)}`),

    loans: (f: { search?: string; status?: string; student_id?: string; campus_id?: string } = {}) => api.get<LibraryLoanRow[]>(`/library/loans${qs(f)}`),
    issue: (body: { book_id?: string; copyId?: string; student_id?: string; borrower_type?: string; borrower_id?: string; due_date: string; notes?: string }) =>
      api.post<BookLoan>('/library/loans/issue', body),
    returnBook: (loanId: string, body: { return_condition: string; damage_notes?: string; collected_amount: number; return_comment?: string }) =>
      api.post<BookLoan>(`/library/loans/${id(loanId)}/return`, body),
    markLost: (loanId: string, body: { replacement_cost: number; processing_fee: number; notes?: string }) =>
      api.post<{ totalCost: number; bookPrice: number; processingFee: number }>(`/library/loans/${id(loanId)}/lost`, body),
    activeLoans: (studentId: string) => api.get<BookLoan[]>(`/library/students/${id(studentId)}/loans/active`),
    overdueLoans: (studentId: string) => api.get<BookLoan[]>(`/library/students/${id(studentId)}/loans/overdue`),
    loanHistory: (studentId: string) => api.get<BookLoan[]>(`/library/students/${id(studentId)}/loans/history`),
    quickLoan: (body: { borrower_type: string; borrower_id: string; book_id: string }) => api.post<unknown>('/library/loans/quick', body),
    loansBorrowers: (type: string, search?: string) => api.get<Record<string, any>[]>(`/library/loans/borrowers${qs({ type, search })}`),
    loansBreakdown: (startDate: string, endDate: string, byCategory: boolean) =>
      api.get<LoansBreakdown>(`/library/loans/breakdown${qs({ start_date: startDate, end_date: endDate, by_category: String(byCategory) })}`),

    searchStudents: (q: string, campusId?: string) => api.get<LibraryStudentHit[]>(`/library/students/search${qs({ q, campus_id: campusId })}`),
    eligibility: (studentId: string) =>
      api.get<{ eligible: boolean; message: string; active_loans?: number; max_books?: number; unpaid_fines?: number; warnings?: string[] }>(`/library/students/${id(studentId)}/eligibility`),
    searchBorrowers: (q: string, type: string) => api.get<LibraryStudentHit[]>(`/library/borrowers/search${qs({ q, type })}`),

    fineStats: () => api.get<LibraryFineStats>('/library/fines/stats'),
    unpaidFines: (studentId: string) => api.get<LibraryFine[]>(`/library/students/${id(studentId)}/fines/unpaid`),
    payFine: (fineId: string) => api.post<LibraryFine>(`/library/fines/${id(fineId)}/pay`),
    stats: (campusId?: string) => api.get<LibraryStats>(`/library/stats${qs({ campus_id: campusId })}`),

    categories: () => api.get<LibraryCategory[]>('/library/categories'),
    createCategory: (body: Partial<LibraryCategory>) => api.post<LibraryCategory>('/library/categories', body),
    updateCategory: (categoryId: string, body: Partial<LibraryCategory>) => api.put<LibraryCategory>(`/library/categories/${id(categoryId)}`, body),
    deleteCategory: (categoryId: string) => api.del<void>(`/library/categories/${id(categoryId)}`),

    documentFields: (categoryId?: string) => api.get<LibraryDocumentField[]>(`/library/document-fields${qs({ category_id: categoryId })}`),
    createDocumentField: (body: Partial<LibraryDocumentField>) => api.post<LibraryDocumentField>('/library/document-fields', body),
    updateDocumentField: (fieldId: string, body: Partial<LibraryDocumentField>) => api.put<LibraryDocumentField>(`/library/document-fields/${id(fieldId)}`, body),
    deleteDocumentField: (fieldId: string) => api.del<void>(`/library/document-fields/${id(fieldId)}`),

    search: (q: string) => api.get<Book[]>(`/library/search${qs({ q })}`),
  }
}
