import { Router } from 'express';
import { libraryController } from '../controllers/library.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== BOOK ROUTES ====================
router.get('/books', requireRole('admin', 'teacher', 'librarian'), libraryController.getBooks);
router.get('/books/:id', requireRole('admin', 'teacher', 'librarian'), libraryController.getBookById);
router.post('/books', requireRole('admin', 'librarian'), libraryController.createBook);
router.put('/books/:id', requireRole('admin', 'librarian'), libraryController.updateBook);
router.delete('/books/:id', requireRole('admin', 'librarian'), libraryController.deleteBook);

// ==================== BOOK COPY ROUTES ====================
router.get('/books/:bookId/copies', requireRole('admin', 'teacher', 'librarian'), libraryController.getBookCopies);
router.get('/books/:bookId/copies/available', requireRole('admin', 'teacher', 'librarian'), libraryController.getAvailableCopies);
router.post('/books/:bookId/copies', requireRole('admin', 'librarian'), libraryController.createBookCopies);
router.put('/copies/:copyId', requireRole('admin', 'librarian'), libraryController.updateBookCopy);
router.delete('/copies/:copyId', requireRole('admin', 'librarian'), libraryController.deleteBookCopy);

// ==================== LOAN ROUTES ====================
router.get('/loans', requireRole('admin', 'teacher', 'librarian'), libraryController.getBookLoans);
router.post('/loans/issue', requireRole('admin', 'librarian'), libraryController.issueBook);
router.post('/loans/:loanId/return', requireRole('admin', 'librarian'), libraryController.returnBook);
router.post('/loans/:loanId/lost', requireRole('admin', 'librarian'), libraryController.markBookLost);
router.get('/students/:studentId/loans/active', requireRole('admin', 'teacher', 'librarian'), libraryController.getActiveLoans);
router.get('/students/:studentId/loans/overdue', requireRole('admin', 'teacher', 'librarian'), libraryController.getOverdueLoans);
router.get('/students/:studentId/loans/history', requireRole('admin', 'teacher', 'librarian'), libraryController.getStudentLoanHistory);

// ==================== STUDENT SEARCH ROUTES ====================
router.get('/students/search', requireRole('admin', 'teacher', 'librarian'), libraryController.searchStudents);
router.get('/students/:studentId/eligibility', requireRole('admin', 'teacher', 'librarian'), libraryController.checkStudentEligibility);

// ==================== FINE ROUTES ====================
router.get('/fines/stats', requireRole('admin', 'librarian'), libraryController.getFineStats);
router.get('/students/:studentId/fines/unpaid', requireRole('admin', 'teacher', 'librarian'), libraryController.getUnpaidFines);
router.post('/fines/:fineId/pay', requireRole('admin', 'librarian'), libraryController.payFine);

// ==================== STATS ROUTE ====================
router.get('/stats', requireRole('admin', 'librarian'), libraryController.getLibraryStats);

export default router;
