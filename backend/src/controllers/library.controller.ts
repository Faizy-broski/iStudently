import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { libraryService } from '../services/library.service';

/**
 * Returns the correct school_id for library queries.
 * Library data (books, copies, loans, etc.) is stored with the CAMPUS id.
 * The auth middleware sets profile.school_id = parent school for librarians,
 * and profile.campus_id = their assigned campus — so we must use campus_id here.
 */
function libSchoolId(req: AuthRequest): string | null {
  const p = req.profile;
  if (!p) return null;
  if (p.role === 'librarian') return p.campus_id || p.school_id || null;
  return p.school_id || null;
}

export class LibraryController {
  // ==================== BOOK ENDPOINTS ====================

  async getELibraryBooks(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }
      const books = await libraryService.getELibraryBooks(schoolId);
      res.json({ success: true, data: books });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBooks(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      const userRole = req.profile?.role;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const books = await libraryService.getBooks(schoolId, userRole);
      res.json({ success: true, data: books });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBookById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const book = await libraryService.getBookById(id, schoolId);
      res.json({ success: true, data: book });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createBook(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const book = await libraryService.createBook(req.body, schoolId);
      res.json({ success: true, data: book });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateBook(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const book = await libraryService.updateBook(id, req.body, schoolId);
      res.json({ success: true, data: book });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteBook(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const result = await libraryService.deleteBook(id, schoolId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== BOOK COPY ENDPOINTS ====================

  async getBookCopies(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const copies = await libraryService.getBookCopies(bookId, schoolId);
      res.json({ success: true, data: copies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAvailableCopies(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const copies = await libraryService.getAvailableCopies(bookId, schoolId);
      res.json({ success: true, data: copies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createBookCopies(req: AuthRequest, res: Response) {
    try {
      const { bookId } = req.params;
      const { numberOfCopies, purchase_date, price, condition_notes } = req.body;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      if (!numberOfCopies || numberOfCopies < 1) {
        return res.status(400).json({ error: 'Number of copies must be at least 1' });
      }

      if (numberOfCopies > 500) {
        return res.status(400).json({ error: 'Number of copies exceeds maximum allowed (500)' });
      }

      const copies = await libraryService.createBookCopies(
        bookId,
        schoolId,
        numberOfCopies,
        { purchase_date, price, condition_notes }
      );

      res.json({ success: true, data: copies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateBookCopy(req: AuthRequest, res: Response) {
    try {
      const { copyId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const copy = await libraryService.updateBookCopy(copyId, req.body, schoolId);
      res.json({ success: true, data: copy });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteBookCopy(req: AuthRequest, res: Response) {
    try {
      const { copyId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const result = await libraryService.deleteBookCopy(copyId, schoolId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== LOAN ENDPOINTS ====================

  async issueBook(req: AuthRequest, res: Response) {
    try {
      const { copyId, book_id, student_id, due_date, notes, borrower_type, borrower_id } = req.body;
      const schoolId = libSchoolId(req);
      const userRole = req.profile?.role || 'student';

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const effectiveBorrowerType = borrower_type || 'student';
      const studentId = student_id || borrower_id || req.body.studentId;

      if (!studentId) {
        return res.status(400).json({ error: 'Borrower ID is required' });
      }

      let finalCopyId = copyId || req.body.copyId;

      if (!finalCopyId && book_id) {
        const copies = await libraryService.getAvailableCopies(book_id, schoolId);
        if (!copies || copies.length === 0) {
          return res.status(400).json({ error: 'No available copies for the selected book' });
        }
        finalCopyId = copies[0].id;
      }

      if (!finalCopyId) {
        return res.status(400).json({ error: 'Copy ID or book_id (with available copies) is required' });
      }

      const dueDate = due_date ? new Date(due_date) : undefined;

      const result = await libraryService.issueBook(finalCopyId, studentId, schoolId, userRole, dueDate, notes, effectiveBorrowerType, borrower_id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async returnBook(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const { collected_amount, return_condition, damage_notes, return_comment } = req.body;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const result = await libraryService.returnBook(loanId, schoolId, collected_amount, return_comment);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async markBookLost(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const { processingFee, processing_fee } = req.body;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      // Support both processingFee and processing_fee parameter names
      const feeToUse = processingFee || processing_fee || 5;
      const result = await libraryService.markBookLost(loanId, schoolId, feeToUse);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getActiveLoans(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const loans = await libraryService.getActiveLoans(studentId, schoolId);
      res.json({ success: true, data: loans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getStudentLoanHistory(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const loans = await libraryService.getStudentLoanHistory(studentId, schoolId);
      res.json({ success: true, data: loans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOverdueLoans(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const loans = await libraryService.getOverdueLoans(studentId, schoolId);
      res.json({ success: true, data: loans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getUnpaidFines(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const fines = await libraryService.getUnpaidFines(studentId, schoolId);
      res.json({ success: true, data: fines });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async payFine(req: AuthRequest, res: Response) {
    try {
      const { fineId } = req.params;
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const fine = await libraryService.payFine(fineId, schoolId);
      res.json({ success: true, data: fine });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBookLoans(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      const { search, status, student_id } = req.query;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const loans = await libraryService.getBookLoans(schoolId, {
        search: search as string,
        status: status as string,
        student_id: student_id as string,
      });
      res.json({ success: true, data: loans });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async searchStudents(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      const { q: query } = req.query;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const students = await libraryService.searchStudents(schoolId, query as string);
      res.json({ success: true, data: students });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async checkStudentEligibility(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      const { studentId } = req.params;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const eligibility = await libraryService.checkStudentEligibility(schoolId, studentId);
      res.json({ success: true, data: eligibility });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getFineStats(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const stats = await libraryService.getFineStats(schoolId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== STATS ENDPOINT ====================
  async getLibraryStats(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const stats = await libraryService.getLibraryStats(schoolId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCategories(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const data = await libraryService.getCategories(schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createCategory(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const data = await libraryService.createCategory(req.body, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateCategory(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const data = await libraryService.updateCategory(req.params.id, req.body, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteCategory(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      await libraryService.deleteCategory(req.params.id, schoolId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: DOCUMENT FIELDS ====================
  async getDocumentFields(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const categoryId = req.query.category_id as string | undefined;
      const data = await libraryService.getDocumentFields(schoolId, categoryId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createDocumentField(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const data = await libraryService.createDocumentField(req.body, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateDocumentField(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const data = await libraryService.updateDocumentField(req.params.fieldId, req.body, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteDocumentField(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      await libraryService.deleteDocumentField(req.params.fieldId, schoolId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: BORROWERS SEARCH ====================
  async searchBorrowers(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const query = req.query.q as string || '';
      const borrowerType = (req.query.type as string) || 'student';
      const data = await libraryService.searchBorrowers(schoolId, query, borrowerType as any);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: LOANS BORROWERS LIST ====================
  async getLoansBorrowers(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const borrowerType = (req.query.type as string) || 'student';
      const search = req.query.search as string | undefined;
      const data = await libraryService.getLoansBorrowers(schoolId, borrowerType as any, search);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: QUICK LOAN ====================
  async quickLoan(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      const userRole = req.profile?.role || 'admin';
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const { borrower_type, borrower_id, book_id } = req.body;
      if (!borrower_id || !book_id) {
        return res.status(400).json({ error: 'borrower_id and book_id are required' });
      }
      const data = await libraryService.quickLoan(schoolId, borrower_type || 'student', borrower_id, book_id, userRole);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: GLOBAL SEARCH ====================
  async globalSearchDocuments(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const query = req.query.q as string || '';
      const data = await libraryService.globalSearchDocuments(schoolId, query);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ==================== PREMIUM: LOANS BREAKDOWN ====================
  async getLoansBreakdown(req: AuthRequest, res: Response) {
    try {
      const schoolId = libSchoolId(req);
      if (!schoolId) return res.status(400).json({ error: 'School ID is required' });
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const byCategory = req.query.by_category === 'true';
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      const data = await libraryService.getLoansBreakdown(schoolId, startDate, endDate, byCategory);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const libraryController = new LibraryController();
