import { Book, BookCopy, BookLoan, LibraryFine } from "@/types";
import { API_URL } from '@/config/api'

// Re-export types
export type { BookCopy, BookLoan };

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
    student_id: string;
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
