import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { libraryService } from '../services/library.service';

export class LibraryController {
  // ==================== BOOK ENDPOINTS ====================

  async getBooks(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;
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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      // Accept either a copyId or a book_id (frontend sends book_id)
      const { copyId, book_id, student_id, due_date, notes } = req.body;
      const schoolId = req.profile?.school_id;
      const userRole = req.profile?.role || 'student';

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const studentId = student_id || req.body.studentId;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }

      let finalCopyId = copyId || req.body.copyId;

      if (!finalCopyId && book_id) {
        // Pick the first available copy for the book
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

      const result = await libraryService.issueBook(finalCopyId, studentId, schoolId, userRole, dueDate, notes);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async returnBook(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const { collected_amount, return_condition, damage_notes } = req.body;
      const schoolId = req.profile?.school_id;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      // collected_amount represents condition/damage fine collected at return
      // This is separate from overdue fines which are added to student's debt
      const result = await libraryService.returnBook(loanId, schoolId, collected_amount);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async markBookLost(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const { processingFee, processing_fee } = req.body;
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;
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
      const schoolId = req.profile?.school_id;
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
      const schoolId = req.profile?.school_id;
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
      const schoolId = req.profile?.school_id;

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
      const schoolId = req.profile?.school_id;

      if (!schoolId) {
        return res.status(400).json({ error: 'School ID is required' });
      }

      const stats = await libraryService.getLibraryStats(schoolId);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const libraryController = new LibraryController();
