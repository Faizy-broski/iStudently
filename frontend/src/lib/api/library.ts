import { Book, BookCopy, BookLoan, LibraryFine, LibraryCategory, LibraryDocumentField } from "@/types";
import { API_URL } from '@/config/api'

// Re-export types
export type { Book, BookCopy, BookLoan, LibraryCategory, LibraryDocumentField };

/**
 * Orders categories parent-then-children (each subcategory right after its
 * parent) with an indent-prefixed label, for rendering in a flat <select> —
 * used wherever a book picks a category, so subcategories stay visible while
 * the parent itself remains directly selectable (an <optgroup> can't do that,
 * since its label isn't selectable).
 */
export function orderCategoriesForSelect(categories: LibraryCategory[]): { id: string; label: string }[] {
  const topLevel = categories.filter((c) => !c.parent_category_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_category_id === parentId);
  const result: { id: string; label: string }[] = [];
  for (const top of topLevel) {
    result.push({ id: top.id, label: top.name });
    for (const child of childrenOf(top.id)) {
      result.push({ id: child.id, label: `— ${child.name}` });
    }
  }
  return result;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== BOOK API ====================

export async function getBooks(token: string): Promise<ApiResponse<Book[]>> {
  const res = await fetch(`${API_URL}/library/books`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getBookById(bookId: string, token: string): Promise<ApiResponse<Book>> {
  const res = await fetch(`${API_URL}/library/books/${bookId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function createBook(bookData: Partial<Book>, token: string): Promise<ApiResponse<Book>> {
  const res = await fetch(`${API_URL}/library/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookData),
  });
  return res.json();
}

export async function updateBook(bookId: string, bookData: Partial<Book>, token: string): Promise<ApiResponse<Book>> {
  const res = await fetch(`${API_URL}/library/books/${bookId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookData),
  });
  return res.json();
}

export async function deleteBook(bookId: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/books/${bookId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getELibraryBooks(token: string): Promise<ApiResponse<Partial<Book>[]>> {
  const res = await fetch(`${API_URL}/library/e-library`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== E-LIBRARY READER STATE (progress + bookmarks) ====================

export interface ReadingProgress {
  bookId: string;
  lastPageIndex: number;
  totalPages: number | null;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  pageIndex: number;
  label: string | null;
  createdAt: string;
}

export async function getReadingProgress(bookId: string, token: string): Promise<ApiResponse<ReadingProgress | null>> {
  const res = await fetch(`${API_URL}/library/e-library/${bookId}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function updateReadingProgress(
  bookId: string,
  data: { lastPageIndex: number; totalPages?: number },
  token: string
): Promise<ApiResponse<ReadingProgress>> {
  const res = await fetch(`${API_URL}/library/e-library/${bookId}/progress`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getBookmarks(bookId: string, token: string): Promise<ApiResponse<Bookmark[]>> {
  const res = await fetch(`${API_URL}/library/e-library/${bookId}/bookmarks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function createBookmark(
  bookId: string,
  data: { pageIndex: number; label?: string },
  token: string
): Promise<ApiResponse<Bookmark>> {
  const res = await fetch(`${API_URL}/library/e-library/${bookId}/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteBookmark(bookmarkId: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/e-library/bookmarks/${bookmarkId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== BOOK COPY API ====================

export async function getBookCopies(bookId: string, token: string): Promise<ApiResponse<BookCopy[]>> {
  const res = await fetch(`${API_URL}/library/books/${bookId}/copies`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getAvailableCopies(bookId: string, token: string): Promise<ApiResponse<BookCopy[]>> {
  const res = await fetch(`${API_URL}/library/books/${bookId}/copies/available`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function createBookCopies(
  bookId: string,
  data: {
    numberOfCopies: number;
    purchase_date?: Date;
    price?: number;
    condition_notes?: string;
  },
  token: string
): Promise<ApiResponse<BookCopy[]>> {
  const res = await fetch(`${API_URL}/library/books/${bookId}/copies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateBookCopy(copyId: string, copyData: Partial<BookCopy>, token: string): Promise<ApiResponse<BookCopy>> {
  const res = await fetch(`${API_URL}/library/copies/${copyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(copyData),
  });
  return res.json();
}

export async function deleteBookCopy(copyId: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/copies/${copyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== LOAN API ====================

export async function issueBook(
  data: {
    book_id?: string;
    copyId?: string;
    student_id?: string;
    borrower_type?: string;
    borrower_id?: string;
    due_date: Date;
    notes?: string;
  },
  token: string
): Promise<ApiResponse<BookLoan>> {
  const res = await fetch(`${API_URL}/library/loans/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function returnBook(
  loanId: string,
  data: {
    return_condition: string;
    damage_notes?: string;
    collected_amount: number;
    return_comment?: string;
  },
  token: string
): Promise<ApiResponse<BookLoan>> {
  const res = await fetch(`${API_URL}/library/loans/${loanId}/return`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function markBookLost(
  loanId: string,
  data: {
    replacement_cost: number;
    processing_fee: number;
    notes?: string;
  },
  token: string
): Promise<ApiResponse<{ totalCost: number; bookPrice: number; processingFee: number }>> {
  const res = await fetch(`${API_URL}/library/loans/${loanId}/lost`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getActiveLoans(studentId: string, token: string): Promise<ApiResponse<BookLoan[]>> {
  const res = await fetch(`${API_URL}/library/students/${studentId}/loans/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getOverdueLoans(studentId: string, token: string): Promise<ApiResponse<BookLoan[]>> {
  const res = await fetch(`${API_URL}/library/students/${studentId}/loans/overdue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getStudentLoanHistory(studentId: string, token: string): Promise<ApiResponse<BookLoan[]>> {
  const res = await fetch(`${API_URL}/library/students/${studentId}/loans/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== FINE API ====================

export async function getUnpaidFines(studentId: string, token: string): Promise<ApiResponse<LibraryFine[]>> {
  const res = await fetch(`${API_URL}/library/students/${studentId}/fines/unpaid`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function getBookLoans(
  filters: {
    search?: string;
    status?: string;
    student_id?: string;
  },
  token: string
): Promise<ApiResponse<BookLoan[]>> {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.student_id) params.append('student_id', filters.student_id);

  const res = await fetch(`${API_URL}/library/loans?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== STUDENT API ====================

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string;
  email?: string;
  phone?: string;
}

export async function searchStudents(query: string, token: string): Promise<ApiResponse<Student[]>> {
  const res = await fetch(`${API_URL}/library/students/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function checkStudentEligibility(
  studentId: string,
  token: string
): Promise<ApiResponse<{
  eligible: boolean;
  message: string;
  warnings?: string[];
}>> {
  const res = await fetch(`${API_URL}/library/students/${studentId}/eligibility`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: CATEGORY API ====================

export async function getCategories(token: string): Promise<ApiResponse<LibraryCategory[]>> {
  const res = await fetch(`${API_URL}/library/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function createCategory(data: Partial<LibraryCategory>, token: string): Promise<ApiResponse<LibraryCategory>> {
  const res = await fetch(`${API_URL}/library/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCategory(id: string, data: Partial<LibraryCategory>, token: string): Promise<ApiResponse<LibraryCategory>> {
  const res = await fetch(`${API_URL}/library/categories/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCategory(id: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: DOCUMENT FIELDS API ====================

export async function getDocumentFields(token: string, categoryId?: string): Promise<ApiResponse<LibraryDocumentField[]>> {
  const params = categoryId ? `?category_id=${categoryId}` : '';
  const res = await fetch(`${API_URL}/library/document-fields${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function createDocumentField(data: Partial<LibraryDocumentField>, token: string): Promise<ApiResponse<LibraryDocumentField>> {
  const res = await fetch(`${API_URL}/library/document-fields`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateDocumentField(fieldId: string, data: Partial<LibraryDocumentField>, token: string): Promise<ApiResponse<LibraryDocumentField>> {
  const res = await fetch(`${API_URL}/library/document-fields/${fieldId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteDocumentField(fieldId: string, token: string): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/document-fields/${fieldId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: BORROWER SEARCH ====================

export async function searchBorrowers(query: string, type: string, token: string): Promise<ApiResponse<Student[]>> {
  const res = await fetch(`${API_URL}/library/borrowers/search?q=${encodeURIComponent(query)}&type=${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: LOANS BORROWERS ====================

export async function getLoansBorrowers(type: string, token: string, search?: string): Promise<ApiResponse<any[]>> {
  const params = new URLSearchParams({ type });
  if (search) params.append('search', search);
  const res = await fetch(`${API_URL}/library/loans/borrowers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: QUICK LOAN ====================

export async function quickLoan(
  data: { borrower_type: string; borrower_id: string; book_id: string },
  token: string
): Promise<ApiResponse> {
  const res = await fetch(`${API_URL}/library/loans/quick`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ==================== PREMIUM: GLOBAL SEARCH ====================

export async function globalSearchDocuments(query: string, token: string): Promise<ApiResponse<Book[]>> {
  const res = await fetch(`${API_URL}/library/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: LOANS BREAKDOWN ====================

export async function getLoansBreakdown(
  startDate: string,
  endDate: string,
  byCategory: boolean,
  token: string
): Promise<ApiResponse<{
  chart_data: any[];
  categories: { name: string; color: string }[];
  total_loans: number;
}>> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    by_category: String(byCategory),
  });
  const res = await fetch(`${API_URL}/library/loans/breakdown?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// ==================== PREMIUM: STATS ====================

export async function getLibraryStats(token: string): Promise<ApiResponse<any>> {
  const res = await fetch(`${API_URL}/library/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
