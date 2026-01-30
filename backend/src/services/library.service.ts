import { supabase } from '../config/supabase';
import { getAllCampusIds, isCampus } from '../utils/school-helpers';
import { Book, BookCopy, BookLoan, BookCopyStatus, LoanStatus } from '../types';

export class LibraryService {
  // ==================== BOOK MANAGEMENT ====================

  /**
   * Get all books for a school
   * - For campus librarians: returns books from their campus only
   * - For admins at parent school: returns books from all campuses
   */
  async getBooks(schoolId: string, userRole?: string) {
    // If user is admin and this is a parent school, show all campus books
    const isParentSchool = !(await isCampus(schoolId));
    const shouldShowAllCampuses = userRole === 'admin' && isParentSchool;
    
    let query = supabase
      .from('library_books')
      .select('*')
      .order('title');

    if (shouldShowAllCampuses) {
      // Admin sees books from all campuses
      const campusIds = await getAllCampusIds(schoolId);
      query = query.in('school_id', campusIds);
    } else {
      // Librarian or campus user sees only their campus books
      query = query.eq('school_id', schoolId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Book[];
  }

  /**
   * Get a single book by ID
   */
  async getBookById(bookId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_books')
      .select('*')
      .eq('id', bookId)
      .eq('school_id', schoolId)
      .single();

    if (error) throw error;
    return data as Book;
  }

  /**
   * Create a new book
   */
  async createBook(bookData: Omit<Book, 'id' | 'created_at' | 'updated_at' | 'total_copies' | 'available_copies'>, schoolId: string) {
    // Sanitize and validate ISBN and publication_year to satisfy DB CHECK constraints
    // Sanitize ISBN: remove any characters other than digits and X, then uppercase
    let isbnToInsert: string | null = null;
    if (bookData.isbn) {
      const cleanIsbn = bookData.isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      if (!this.isValidISBN(cleanIsbn)) {
        throw new Error('Invalid ISBN format');
      }
      isbnToInsert = cleanIsbn;
    }

    // Normalize publication_year: treat empty string as null and validate range
    let publicationYearToInsert: number | null = null;
    if (bookData.publication_year !== undefined && bookData.publication_year !== null && String(bookData.publication_year) !== '') {
      const year = Number(bookData.publication_year);
      const maxYear = new Date().getFullYear() + 5;
      if (!Number.isInteger(year) || year < 1000 || year > maxYear) {
        throw new Error(`publication_year must be between 1000 and ${maxYear}`);
      }
      publicationYearToInsert = year;
    }

    const insertPayload = {
      ...bookData,
      isbn: isbnToInsert,
      publication_year: publicationYearToInsert,
      school_id: schoolId,
      total_copies: 0,
      available_copies: 0
    };

    try {
      const { data, error } = await supabase
        .from('library_books')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('CreateBook DB error', { insertPayload, error });
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('check') || msg.includes('constraint') || msg.includes('violates')) {
          throw new Error('Failed to create book — input violates database constraints (ISBN or publication_year).');
        }
        throw error;
      }

      return data as Book;
    } catch (err: any) {
      console.error('CreateBook failed', { insertPayload, err });
      // Rewrap known constraint errors for a cleaner client message
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('check') || msg.includes('constraint') || msg.includes('violates')) {
        throw new Error('Failed to create book — input violates database constraints (ISBN or publication_year).');
      }
      throw err;
    }
  }

  /**
   * Update a book
   */
  async updateBook(bookId: string, bookData: Partial<Book>, schoolId: string) {
    // Sanitize ISBN if present
    if (bookData.isbn) {
      const cleanIsbn = String(bookData.isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
      if (!this.isValidISBN(cleanIsbn)) {
        throw new Error('Invalid ISBN format');
      }
      bookData.isbn = cleanIsbn as any;
    }

    // Normalize publication_year: treat empty string as null and validate range
    if (String(bookData.publication_year) === '') {
      bookData.publication_year = null as any;
    }

    if (bookData.publication_year !== undefined && bookData.publication_year !== null) {
      const year = Number(bookData.publication_year);
      const maxYear = new Date().getFullYear() + 5;
      if (!Number.isInteger(year) || year < 1000 || year > maxYear) {
        throw new Error(`publication_year must be between 1000 and ${maxYear}`);
      }
      bookData.publication_year = year as any;
    }

    try {
      const { data, error } = await supabase
        .from('library_books')
        .update(bookData)
        .eq('id', bookId)
        .eq('school_id', schoolId)
        .select()
        .single();

      if (error) {
        console.error('UpdateBook DB error', { bookId, bookData, error });
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('check') || msg.includes('constraint') || msg.includes('violates')) {
          throw new Error('Failed to update book — input violates database constraints (ISBN or publication_year).');
        }
        throw error;
      }

      return data as Book;
    } catch (err: any) {
      console.error('UpdateBook failed', { bookId, bookData, err });
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('check') || msg.includes('constraint') || msg.includes('violates')) {
        throw new Error('Failed to update book — input violates database constraints (ISBN or publication_year).');
      }
      throw err;
    }
  }

  /**
   * Delete a book (only if no copies exist)
   */
  async deleteBook(bookId: string, schoolId: string) {
    // Check if book has copies
    const { count } = await supabase
      .from('library_book_copies')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', bookId)
      .eq('school_id', schoolId);

    if (count && count > 0) {
      throw new Error('Cannot delete book with existing copies. Delete all copies first.');
    }

    const { error } = await supabase
      .from('library_books')
      .delete()
      .eq('id', bookId)
      .eq('school_id', schoolId);

    if (error) throw error;
    return { success: true };
  }

  // ==================== BOOK COPY MANAGEMENT ====================

  /**
   * Get all copies for a book
   */
  async getBookCopies(bookId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_book_copies')
      .select('*, library_books(*)')
      .eq('book_id', bookId)
      .eq('school_id', schoolId)
      .order('accession_number');

    if (error) throw error;
    return data as (BookCopy & { library_books: Book })[];
  }

  /**
   * Get available copies for a book
   */
  async getAvailableCopies(bookId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_book_copies')
      .select('*')
      .eq('book_id', bookId)
      .eq('school_id', schoolId)
      .eq('status', 'available')
      .order('accession_number');

    if (error) throw error;
    return data as BookCopy[];
  }

  /**
   * Create book copies with auto-generated accession numbers
   */
  async createBookCopies(
    bookId: string,
    schoolId: string,
    numberOfCopies: number,
    copyData: {
      purchase_date?: Date;
      price?: number;
      condition_notes?: string;
    }
  ) {
    // Basic validation and guardrails
    if (numberOfCopies < 1 || numberOfCopies > 500) {
      throw new Error('Number of copies must be between 1 and 500');
    }

    // Attempt to create copies in batch and retry on unique-constraint conflicts
    const maxRetries = 3;
    let attempt = 0;
    let insertedData: any = null;

    while (attempt < maxRetries) {
      const nextAccessionNumber = await this.getNextAccessionNumber(schoolId);

      const copies: Omit<BookCopy, 'id' | 'created_at' | 'updated_at'>[] = [];
      for (let i = 0; i < numberOfCopies; i++) {
        const accessionNumber = `LIB-${(nextAccessionNumber + i).toString().padStart(6, '0')}`;
        copies.push({
          book_id: bookId,
          school_id: schoolId,
          accession_number: accessionNumber,
          status: 'available',
          purchase_date: copyData.purchase_date || null,
          price: copyData.price || null,
          condition_notes: copyData.condition_notes || null
        });
      }

      console.log(`Library: creating ${copies.length} copies for book ${bookId}, attempt ${attempt + 1}`);
      const { data, error } = await supabase
        .from('library_book_copies')
        .insert(copies)
        .select();

      if (!error) {
        insertedData = data;
        console.log(`Library: inserted ${insertedData.length} copies for book ${bookId}`);
        break;
      }

      // If unique-constraint conflict, retry with updated next accession number
      const errMsg = String(error?.message || '').toLowerCase();
      const isUniqueViolation = (error?.code === '23505') || errMsg.includes('unique') || errMsg.includes('duplicate');
      if (!isUniqueViolation) {
        throw error;
      }

      attempt++;
      // small backoff
      await new Promise((r) => setTimeout(r, 100 * attempt));
    }

    if (!insertedData) {
      throw new Error('Unable to insert copies due to accession number conflicts. Please try again.');
    }

    // Update book total_copies and available_copies
    await this.updateBookCopiesCount(bookId, schoolId);

    return insertedData as BookCopy[];
  }

  /**
   * Update a book copy
   */
  async updateBookCopy(copyId: string, copyData: Partial<BookCopy>, schoolId: string) {
    const { data, error } = await supabase
      .from('library_book_copies')
      .update(copyData)
      .eq('id', copyId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;

    // Update book counts
    if (data) {
      await this.updateBookCopiesCount(data.book_id, schoolId);
    }

    return data as BookCopy;
  }

  /**
   * Delete a book copy (only if not currently issued)
   */
  async deleteBookCopy(copyId: string, schoolId: string) {
    // Check if copy is currently issued
    const { data: copy } = await supabase
      .from('library_book_copies')
      .select('status, book_id')
      .eq('id', copyId)
      .eq('school_id', schoolId)
      .single();

    if (!copy) throw new Error('Copy not found');
    if (copy.status === 'issued') {
      throw new Error('Cannot delete a copy that is currently issued');
    }

    const { error } = await supabase
      .from('library_book_copies')
      .delete()
      .eq('id', copyId)
      .eq('school_id', schoolId);

    if (error) throw error;

    // Update book counts
    await this.updateBookCopiesCount(copy.book_id, schoolId);

    return { success: true };
  }

  // ==================== LOAN MANAGEMENT ====================

  /**
   * Issue a book to a student with comprehensive validations
   */
  async issueBook(
    copyId: string,
    studentId: string,
    schoolId: string,
    _userRole: string,
    dueDateOverride?: Date,
    notes?: string
  ) {
    // Validation 1: Check if copy exists and is available
    const { data: copy } = await supabase
      .from('library_book_copies')
      .select('status, book_id')
      .eq('id', copyId)
      .eq('school_id', schoolId)
      .single();

    if (!copy) throw new Error('Book copy not found');
    if (copy.status !== 'available') {
      throw new Error(`Book copy is not available. Current status: ${copy.status}`);
    }

    // Validation 2: Check if student account is active
    const { data: student } = await supabase
      .from('profiles')
      .select('is_active, role')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single();

    if (!student) throw new Error('Student not found');
    if (!student.is_active) {
      throw new Error('Student account is inactive. Cannot issue books.');
    }

    // Validation 3: Check for overdue books
    const overdueLoans = await this.getOverdueLoans(studentId, schoolId);
    if (overdueLoans.length > 0) {
      throw new Error('Student has overdue books. Please return them before issuing new books.');
    }

    // Validation 4: Check max books limit
    const activeLoans = await this.getActiveLoans(studentId, schoolId);
    const { data: school } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    const maxBooks = school?.settings?.library?.max_books_per_student || 3;
    if (activeLoans.length >= maxBooks) {
      throw new Error(`Student has reached maximum book limit (${maxBooks} books)`);
    }

    // Validation 5: Check for unpaid fines (Warning - not blocker)
    const unpaidFines = await this.getUnpaidFines(studentId, schoolId);
    const totalUnpaidFines = unpaidFines.reduce((sum, fine) => sum + fine.amount, 0);

    // Calculate due date based on school settings unless overridden
    const dueDate = dueDateOverride ? new Date(dueDateOverride) : new Date();
    if (!dueDateOverride) {
      // Get loan duration from school settings
      const loanDuration = school?.settings?.library?.loan_duration_days || 14;
      dueDate.setDate(dueDate.getDate() + loanDuration);
    }

    // Create the loan
    const { data: loan, error } = await supabase
      .from('library_loans')
      .insert({
        book_copy_id: copyId,
        student_id: studentId,
        school_id: schoolId,
        issue_date: new Date(),
        due_date: dueDate,
        status: 'active',
        fine_amount: 0,
        collected_amount: 0,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    // Update copy status to 'issued'
    await supabase
      .from('library_book_copies')
      .update({ status: 'issued' })
      .eq('id', copyId);

    // Update book available_copies count
    await this.updateBookCopiesCount(copy.book_id, schoolId);

    return {
      loan: this.normalizeLoan(loan as any),
      warning: totalUnpaidFines > 0 ? `Student has $${totalUnpaidFines} in unpaid fines` : null
    };
  }

  /**
   * Return a book and calculate fines
   * Two types of fines:
   * 1. Overdue fine - Added to student's unpaid fines (not collected immediately)
   * 2. Condition/damage fine - Collected immediately at return
   */
  async returnBook(
    loanId: string,
    schoolId: string,
    collectedAmount?: number
  ) {
    // Get the loan
    const { data: loan } = await supabase
      .from('library_loans')
      .select('*, library_book_copies(book_id)')
      .eq('id', loanId)
      .eq('school_id', schoolId)
      .single();

    if (!loan) throw new Error('Loan not found');
    if (loan.status === 'returned') {
      throw new Error('Book has already been returned');
    }

    const returnDate = new Date();
    const dueDate = new Date(loan.due_date);
    let overdueFine = 0;
    let daysLate = 0;

    // Calculate overdue fine if returned late
    if (returnDate > dueDate) {
      daysLate = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get daily fine rate from school settings
      const { data: school } = await supabase
        .from('schools')
        .select('settings')
        .eq('id', schoolId)
        .single();

      const finePerDay = school?.settings?.library?.fine_per_day || 0.5;
      overdueFine = daysLate * finePerDay;
    }

    // collectedAmount represents condition/damage fine collected at return time
    // It's separate from overdue fine
    const conditionFineCollected = typeof collectedAmount === 'number' && collectedAmount > 0 ? collectedAmount : 0;

    // For database constraint: fine_amount is overdue fine, collected_amount is condition fine
    // They are independent - we don't enforce collected <= fine here
    const totalFineAmount = overdueFine;
    const totalCollectedAmount = conditionFineCollected;

    // Update the loan
    const { data: updatedLoan, error: loanError } = await supabase
      .from('library_loans')
      .update({
        return_date: returnDate,
        status: 'returned',
        fine_amount: totalFineAmount,
        collected_amount: totalCollectedAmount
      })
      .eq('id', loanId)
      .select()
      .single();

    if (loanError) throw loanError;

    // Update copy status back to 'available'
    await supabase
      .from('library_book_copies')
      .update({ status: 'available' })
      .eq('id', loan.book_copy_id);

    // Update book available_copies count
    if (loan.library_book_copies) {
      await this.updateBookCopiesCount(loan.library_book_copies.book_id, schoolId);
    }

    // Create fine record for OVERDUE fine (added to student's unpaid fines)
    if (overdueFine > 0) {
      await supabase
        .from('library_fines')
        .insert({
          loan_id: loanId,
          student_id: loan.student_id,
          school_id: schoolId,
          amount: overdueFine,
          paid: false,
          reason: `Late return - ${daysLate} days overdue`
        });
    }

    // Note: Condition fine (collectedAmount) is NOT added to library_fines table
    // It's recorded in loan.collected_amount as money collected immediately

    return {
      loan: this.normalizeLoan(updatedLoan as any),
      fine: totalFineAmount,
      daysLate,
      collected: totalCollectedAmount > 0
    };
  }

  /**
   * Mark a book as lost and charge the student
   */
  async markBookLost(
    loanId: string,
    schoolId: string,
    processingFee: number = 5
  ) {
    // Get the loan and book details
    const { data: loan } = await supabase
      .from('library_loans')
      .select('*, library_book_copies(price, book_id)')
      .eq('id', loanId)
      .eq('school_id', schoolId)
      .single();

    if (!loan) throw new Error('Loan not found');
    if (loan.status === 'lost') {
      throw new Error('Book is already marked as lost');
    }

    const bookPrice = loan.library_book_copies?.price || 0;
    const totalCost = bookPrice + processingFee;

    // Update loan status to 'lost'
    await supabase
      .from('library_loans')
      .update({
        status: 'lost',
        fine_amount: totalCost,
        fine_paid: false
      })
      .eq('id', loanId);

    // Update copy status to 'lost'
    await supabase
      .from('library_book_copies')
      .update({ status: 'lost' })
      .eq('id', loan.book_copy_id);

    // Update book counts
    if (loan.library_book_copies) {
      await this.updateBookCopiesCount(loan.library_book_copies.book_id, schoolId);
    }

    // Create fine record
    await supabase
      .from('library_fines')
      .insert({
        loan_id: loanId,
        student_id: loan.student_id,
        school_id: schoolId,
        amount: totalCost,
        paid: false,
        reason: `Lost book - Book price: $${bookPrice}, Processing fee: $${processingFee}`
      });

    return {
      totalCost,
      bookPrice,
      processingFee
    };
  }

  /**
   * Get active loans for a student
   */
  async getActiveLoans(studentId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_loans')
      .select('*, library_book_copies(*, library_books(*))')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .order('issue_date', { ascending: false });

    if (error) throw error;
    return (data || []).map((l: any) => this.normalizeLoan(l));
  }

  /**
   * Get overdue loans for a student
   */
  async getOverdueLoans(studentId: string, schoolId: string) {
    const today = new Date().toISOString();

    const { data, error } = await supabase
      .from('library_loans')
      .select('*, library_book_copies(*, library_books(*))')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .lt('due_date', today);

    if (error) throw error;
    return (data || []).map((l: any) => this.normalizeLoan(l));
  }

  /**
   * Get loan history for a student
   */
  async getStudentLoanHistory(studentId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_loans')
      .select('*, library_book_copies(*, library_books(*))')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('issue_date', { ascending: false });

    if (error) throw error;
    return (data || []).map((l: any) => this.normalizeLoan(l));
  }

  /**
   * Get unpaid fines for a student
   */
  async getUnpaidFines(studentId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_fines')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('paid', false);

    if (error) throw error;
    return data;
  }

  /**
   * Mark a fine as paid
   */
  async payFine(fineId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('library_fines')
      .update({
        paid: true,
        paid_at: new Date()
      })
      .eq('id', fineId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate ISBN format (ISBN-10 or ISBN-13)
   */
  private isValidISBN(isbn: string): boolean {
    // Remove hyphens and spaces
    const cleanISBN = isbn.replace(/[-\s]/g, '');

    // Check ISBN-10
    if (cleanISBN.length === 10) {
      return /^\d{9}[\dX]$/.test(cleanISBN);
    }

    // Check ISBN-13
    if (cleanISBN.length === 13) {
      return /^\d{13}$/.test(cleanISBN);
    }

    return false;
  }

  /**
   * Check if accession number is unique within school (reserved for future use)
   */
  // private async isAccessionNumberUnique(accessionNumber: string, schoolId: string): Promise<boolean> {
  //   const { count } = await supabase
  //     .from('library_book_copies')
  //     .select('*', { count: 'exact', head: true })
  //     .eq('accession_number', accessionNumber)
  //     .eq('school_id', schoolId);

  //   return count === 0;
  // }

  /**
   * Get next accession number for the school
   */
  private async getNextAccessionNumber(schoolId: string): Promise<number> {
    const { data } = await supabase
      .from('library_book_copies')
      .select('accession_number')
      .eq('school_id', schoolId)
      .order('accession_number', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 1;

    // Extract number from format LIB-000001
    const lastNumber = data[0].accession_number.replace('LIB-', '');
    return parseInt(lastNumber) + 1;
  }

  /**
   * Update book total_copies and available_copies count
   */
  private async updateBookCopiesCount(bookId: string, schoolId: string) {
    const { data: copies } = await supabase
      .from('library_book_copies')
      .select('status')
      .eq('book_id', bookId)
      .eq('school_id', schoolId);

    if (!copies) return;

    const totalCopies = copies.length;
    const availableCopies = copies.filter(c => c.status === 'available').length;

    await supabase
      .from('library_books')
      .update({
        total_copies: totalCopies,
        available_copies: availableCopies
      })
      .eq('id', bookId)
      .eq('school_id', schoolId);
  }

  // ==================== LOAN SEARCH ====================

  /**
   * Get book loans with filters
   */
  async getBookLoans(schoolId: string, filters: { search?: string; status?: string; student_id?: string }) {
    let query = supabase
      .from('library_loans')
      .select(`
        *,
        book_copy:library_book_copies(
          accession_number,
          price,
          book:library_books(title)
        )
      `)
      .eq('school_id', schoolId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('getBookLoans error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch profiles separately since there's no FK relationship defined
    const studentIds = [...new Set(data.map((loan: any) => loan.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', studentIds);

    // Fetch student records to get student numbers
    // Note: profile_id in students table links to profiles.id
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, profile_id, student_number, school_id')
      .in('profile_id', studentIds);

    if (studentsError) {
      console.error('Error fetching students for loans:', studentsError);
    }

    console.log('Loans student lookup:', {
      studentIds,
      studentsFound: students?.length || 0,
      studentProfileIds: students?.map(s => s.profile_id) || []
    });

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const studentMap = new Map(students?.map(s => [s.profile_id, s]) || []);

    // Transform and filter the data to match the expected format
    let loans = data.map((loan: any) => {
      const profile = profileMap.get(loan.student_id);
      const student = studentMap.get(loan.student_id);
      return {
        id: loan.id,
        book_copy_id: loan.book_copy_id,
        student_id: loan.student_id,
        school_id: loan.school_id,
        issue_date: loan.issue_date,
        due_date: loan.due_date,
        return_date: loan.return_date,
        status: loan.status,
        fine_amount: loan.fine_amount,
        collected_amount: loan.collected_amount ?? 0,
        notes: loan.notes,
        created_at: loan.created_at,
        updated_at: loan.updated_at,
        book_title: loan.book_copy?.book?.title || 'Unknown',
        student_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Unknown',
        student_number: student?.student_number || 'N/A',
        accession_number: loan.book_copy?.accession_number || 'N/A',
        book_price: loan.book_copy?.price,
      };
    });

    // Apply client-side search filter if provided
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      loans = loans.filter((loan: any) =>
        loan.book_title?.toLowerCase().includes(searchLower) ||
        loan.student_name?.toLowerCase().includes(searchLower) ||
        loan.student_number?.toLowerCase().includes(searchLower) ||
        loan.accession_number?.toLowerCase().includes(searchLower)
      );
    }

    return loans;
  }

  // ==================== STUDENT SEARCH ====================

  /**
   * Search students for library operations
   */
  async searchStudents(schoolId: string, query: string) {
    const q = (query || '').trim();
    if (!q) return [];

    // If query looks like a UUID, search by id directly (exact match)
    const isUUID = /^[0-9a-fA-F-]{36}$/.test(q);

    try {
      if (isUUID) {
        const { data, error } = await supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, class_name, email, phone, status')
          .eq('school_id', schoolId)
          .eq('id', q)
          .limit(10);

        if (error) {
          console.error('searchStudents by id error', { schoolId, query: q, error });
          throw error;
        }

        return data;
      }

      // Broad search across multiple fields (profile first/last name, admission number, profile email, student id)
      const like = `%${q}%`;
      const orExpr = `profile.first_name.ilike.${like},profile.last_name.ilike.${like},admission_number.ilike.${like},profile.email.ilike.${like},id.ilike.${like}`;

      const { data, error } = await supabase
        .from('students')
        .select('id, admission_number, class_name, status, profile:profiles(first_name, last_name, email, phone)')
        .eq('school_id', schoolId)
        .or(orExpr)
        .eq('status', 'active')
        .limit(10);

      if (error) {
        console.error('searchStudents error', { schoolId, query: q, error });
        throw error;
      }

      console.log('searchStudents result count', { schoolId, query: q, count: (data || []).length });

      // Map to expected shape for frontend
      return (data || []).map((s: any) => ({
        id: s.id,
        first_name: s.profile?.first_name || null,
        last_name: s.profile?.last_name || null,
        admission_number: s.admission_number || null,
        class_name: s.class_name || null,
        email: s.profile?.email || null,
        phone: s.profile?.phone || null,
        status: s.status
      }));
    } catch (err) {
      console.error('searchStudents failed', { schoolId, query: q, err });
      throw err;
    }
  }

  /**
   * Normalize loan properties to ensure consistent defaults
   */
  private normalizeLoan(loan: any) {
    if (!loan) return loan;

    return {
      ...loan,
      collected_amount: loan.collected_amount ?? 0
    };
  }

  /**
   * Check student eligibility for book loans using database function
   */
  async checkStudentEligibility(schoolId: string, studentId: string) {
    try {
      // Use the database function for consistency and performance
      const { data, error } = await supabase.rpc('check_student_library_eligibility', {
        p_school_id: schoolId,
        p_student_id: studentId
      });

      if (error) {
        console.error('checkStudentEligibility RPC error:', error);
        throw error;
      }

      return data;
    } catch (err: any) {
      console.error('checkStudentEligibility failed:', { schoolId, studentId, err });

      // Fallback to client-side check if database function is not available
      return this.checkStudentEligibilityFallback(schoolId, studentId);
    }
  }

  /**
   * Fallback eligibility check (client-side) if database function unavailable
   */
  private async checkStudentEligibilityFallback(schoolId: string, studentId: string) {
    // Check if profile exists and is active
    // Note: library_loans.student_id references profiles.id, so we check profile directly
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single();

    if (profileError || !profile) {
      console.error('checkStudentEligibilityFallback: profile not found', { schoolId, studentId, profileError });
      return { eligible: false, message: 'Student not found' };
    }

    if (!profile.is_active) {
      return { eligible: false, message: 'Student account is not active' };
    }

    // Use profile id for loans/fines because library_loans.student_id references profiles.id
    const borrowerId = profile.id;

    // Check active loans
    const { data: activeLoans, error: loansError } = await supabase
      .from('library_loans')
      .select('id, due_date, status')
      .eq('student_id', borrowerId)
      .eq('school_id', schoolId)
      .in('status', ['active', 'overdue']);

    if (loansError) throw loansError;

    const activeLoanCount = activeLoans?.length || 0;
    const overdueLoans = activeLoans?.filter(loan => loan.status === 'overdue') || [];
    const overdueCount = overdueLoans.length;

    // Check max loans limit (assuming 3 max loans)
    const maxLoans = 3;
    if (activeLoanCount >= maxLoans) {
      return {
        eligible: false,
        message: `Student has reached maximum loan limit (${maxLoans})`,
        active_loans: activeLoanCount,
        max_books: maxLoans,
        warnings: [`Currently has ${activeLoanCount} active loans`]
      };
    }

    // Check for overdue books
    if (overdueCount > 0) {
      return {
        eligible: false,
        message: 'Student has overdue books',
        overdue_loans: overdueCount,
        warnings: [`${overdueCount} overdue book(s) must be returned first`]
      };
    }

    // Check for unpaid fines
    const { data: unpaidFines, error: finesError } = await supabase
      .from('library_fines')
      .select('amount')
      .eq('student_id', borrowerId)
      .eq('school_id', schoolId)
      .eq('paid', false);

    if (finesError) throw finesError;

    const totalUnpaidFines = unpaidFines?.reduce((sum, fine) => sum + fine.amount, 0) || 0;

    const warnings = [];
    if (totalUnpaidFines > 0) {
      warnings.push(`Outstanding fines: $${totalUnpaidFines.toFixed(2)}`);
    }

    return {
      eligible: true,
      message: 'Student is eligible for book loans',
      active_loans: activeLoanCount,
      max_books: maxLoans,
      unpaid_fines: totalUnpaidFines,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Get fine statistics for admin dashboard
   * Returns both overdue fines and condition fines collected
   */
  async getFineStats(schoolId: string) {
    // Get overdue fines from library_fines table
    const { data: fines, error: finesError } = await supabase
      .from('library_fines')
      .select('id, amount, paid, reason, created_at, loan_id, student_id')
      .eq('school_id', schoolId);

    if (finesError) throw finesError;

    const unpaidOverdueFines = fines?.filter(f => !f.paid).reduce((sum, f) => sum + f.amount, 0) || 0;
    const paidOverdueFines = fines?.filter(f => f.paid).reduce((sum, f) => sum + f.amount, 0) || 0;
    const totalOverdueFines = unpaidOverdueFines + paidOverdueFines;

    // Get condition fines from library_loans.collected_amount
    const { data: loans, error: loansError } = await supabase
      .from('library_loans')
      .select('id, collected_amount, return_date, student_id, book_copy_id, created_at')
      .eq('school_id', schoolId)
      .eq('status', 'returned')
      .gt('collected_amount', 0);

    if (loansError) throw loansError;

    const totalConditionFines = loans?.reduce((sum, l) => sum + (l.collected_amount || 0), 0) || 0;

    // Get recent fines with details for display
    const recentFines = [];

    // Add overdue fines
    if (fines && fines.length > 0) {
      const loanIds = fines.map(f => f.loan_id).filter(Boolean);
      const { data: loanDetails } = await supabase
        .from('library_loans')
        .select('id, book_copy_id, student_id')
        .in('id', loanIds);

      const bookCopyIds = loanDetails?.map(l => l.book_copy_id) || [];
      const { data: bookCopies } = await supabase
        .from('library_book_copies')
        .select('id, book_id')
        .in('id', bookCopyIds);

      const bookIds = bookCopies?.map(bc => bc.book_id) || [];
      const { data: books } = await supabase
        .from('library_books')
        .select('id, title')
        .in('id', bookIds);

      const studentIds = [...new Set([...fines.map(f => f.student_id), ...loanDetails?.map(l => l.student_id) || []])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', studentIds);

      const bookCopyMap = new Map(bookCopies?.map(bc => [bc.id, bc.book_id]) || []);
      const bookMap = new Map(books?.map(b => [b.id, b.title]) || []);
      const loanMap = new Map(loanDetails?.map(l => [l.id, l]) || []);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      for (const fine of fines.slice(0, 10)) {
        const loan = loanMap.get(fine.loan_id);
        const bookCopyId = loan?.book_copy_id;
        const bookId = bookCopyId ? bookCopyMap.get(bookCopyId) : null;
        const bookTitle = bookId ? bookMap.get(bookId) : 'Unknown';
        const profile = profileMap.get(fine.student_id);
        const studentName = profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown';

        recentFines.push({
          id: fine.id,
          student_name: studentName,
          book_title: bookTitle || 'Unknown',
          amount: fine.amount,
          type: 'overdue',
          paid: fine.paid,
          created_at: fine.created_at
        });
      }
    }

    // Add condition fines
    if (loans && loans.length > 0) {
      const bookCopyIds = loans.map(l => l.book_copy_id);
      const { data: bookCopies } = await supabase
        .from('library_book_copies')
        .select('id, book_id')
        .in('id', bookCopyIds);

      const bookIds = bookCopies?.map(bc => bc.book_id) || [];
      const { data: books } = await supabase
        .from('library_books')
        .select('id, title')
        .in('id', bookIds);

      const studentIds = [...new Set(loans.map(l => l.student_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', studentIds);

      const bookCopyMap = new Map(bookCopies?.map(bc => [bc.id, bc.book_id]) || []);
      const bookMap = new Map(books?.map(b => [b.id, b.title]) || []);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      for (const loan of loans.slice(0, 10)) {
        const bookId = bookCopyMap.get(loan.book_copy_id);
        const bookTitle = bookId ? bookMap.get(bookId) : 'Unknown';
        const profile = profileMap.get(loan.student_id);
        const studentName = profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown';

        recentFines.push({
          id: loan.id,
          student_name: studentName,
          book_title: bookTitle || 'Unknown',
          amount: loan.collected_amount,
          type: 'condition',
          paid: true, // condition fines are always collected immediately
          created_at: loan.return_date || loan.created_at
        });
      }
    }

    // Sort by date descending
    recentFines.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      total_overdue_fines: totalOverdueFines,
      unpaid_overdue_fines: unpaidOverdueFines,
      paid_overdue_fines: paidOverdueFines,
      total_condition_fines: totalConditionFines,
      overdue_fines_count: fines?.length || 0,
      recent_fines: recentFines.slice(0, 20) // Return top 20
    };
  }

  /**
   * Get comprehensive library statistics for dashboard
   */
  async getLibraryStats(schoolId: string) {
    // Get total books count
    const { count: totalBooks } = await supabase
      .from('library_books')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId);

    // Get total copies and available copies
    const { data: copies } = await supabase
      .from('library_book_copies')
      .select('status')
      .eq('school_id', schoolId);

    const totalCopies = copies?.length || 0;
    const availableCopies = copies?.filter(c => c.status === 'available').length || 0;
    const issuedCopies = copies?.filter(c => c.status === 'issued').length || 0;
    const lostCopies = copies?.filter(c => c.status === 'lost').length || 0;

    // Get active loans count
    const { count: activeLoans } = await supabase
      .from('library_loans')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active');

    // Get overdue loans count
    const today = new Date().toISOString();
    const { count: overdueLoans } = await supabase
      .from('library_loans')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .lt('due_date', today);

    // Get fines data
    const { data: fines } = await supabase
      .from('library_fines')
      .select('amount, paid')
      .eq('school_id', schoolId);

    const totalFinesCollected = fines?.filter(f => f.paid).reduce((sum, f) => sum + f.amount, 0) || 0;
    const pendingFines = fines?.filter(f => !f.paid).reduce((sum, f) => sum + f.amount, 0) || 0;

    // Get recent loans for dashboard
    const { data: recentLoans } = await supabase
      .from('library_loans')
      .select(`
        id, issue_date, due_date, status,
        book_copy:library_book_copies(
          accession_number,
          book:library_books(title)
        )
      `)
      .eq('school_id', schoolId)
      .order('issue_date', { ascending: false })
      .limit(5);

    // Get student info for recent loans
    const studentIds = recentLoans?.map((l: any) => l.student_id).filter(Boolean) || [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', studentIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const recentLoansFormatted = (recentLoans || []).map((loan: any) => ({
      id: loan.id,
      book_title: loan.book_copy?.book?.title || 'Unknown',
      issue_date: loan.issue_date,
      due_date: loan.due_date,
      status: loan.status,
    }));

    // Get overdue books list for dashboard
    const { data: overdueList } = await supabase
      .from('library_loans')
      .select(`
        id, issue_date, due_date, student_id,
        book_copy:library_book_copies(
          accession_number,
          book:library_books(title)
        )
      `)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(5);

    const overdueStudentIds = overdueList?.map((l: any) => l.student_id).filter(Boolean) || [];
    const { data: overdueProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', overdueStudentIds.length ? overdueStudentIds : ['none']);

    const overdueProfileMap = new Map(overdueProfiles?.map(p => [p.id, p]) || []);

    const overdueListFormatted = (overdueList || []).map((loan: any) => {
      const profile = overdueProfileMap.get(loan.student_id);
      return {
        id: loan.id,
        book_title: loan.book_copy?.book?.title || 'Unknown',
        student_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        due_date: loan.due_date,
        days_overdue: Math.ceil((new Date().getTime() - new Date(loan.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      };
    });

    return {
      total_books: totalBooks || 0,
      total_copies: totalCopies,
      available_copies: availableCopies,
      issued_copies: issuedCopies,
      lost_copies: lostCopies,
      active_loans: activeLoans || 0,
      overdue_loans: overdueLoans || 0,
      total_fines_collected: totalFinesCollected,
      pending_fines: pendingFines,
      recent_loans: recentLoansFormatted,
      overdue_list: overdueListFormatted,
    };
  }
}

export const libraryService = new LibraryService();
