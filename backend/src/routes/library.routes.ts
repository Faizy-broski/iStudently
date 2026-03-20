import { Router } from 'express';
import { libraryController } from '../controllers/library.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== E-LIBRARY (STUDENT-ACCESSIBLE) ====================
// Returns only books with a file_url — safe for students to browse
router.get('/e-library', requireRole('admin', 'teacher', 'librarian', 'student'), libraryController.getELibraryBooks);

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

// ==================== PREMIUM: CATEGORIES ====================
router.get('/categories', requireRole('admin', 'librarian'), libraryController.getCategories);
router.post('/categories', requireRole('admin', 'librarian'), libraryController.createCategory);
router.put('/categories/:id', requireRole('admin', 'librarian'), libraryController.updateCategory);
router.delete('/categories/:id', requireRole('admin', 'librarian'), libraryController.deleteCategory);

// ==================== PREMIUM: DOCUMENT FIELDS ====================
router.get('/document-fields', requireRole('admin', 'librarian'), libraryController.getDocumentFields);
router.post('/document-fields', requireRole('admin', 'librarian'), libraryController.createDocumentField);
router.put('/document-fields/:fieldId', requireRole('admin', 'librarian'), libraryController.updateDocumentField);
router.delete('/document-fields/:fieldId', requireRole('admin', 'librarian'), libraryController.deleteDocumentField);

// ==================== PREMIUM: BORROWERS ====================
router.get('/borrowers/search', requireRole('admin', 'librarian'), libraryController.searchBorrowers);
router.get('/loans/borrowers', requireRole('admin', 'librarian'), libraryController.getLoansBorrowers);

// ==================== PREMIUM: QUICK LOAN ====================
router.post('/loans/quick', requireRole('admin', 'librarian'), libraryController.quickLoan);

// ==================== PREMIUM: GLOBAL SEARCH ====================
router.get('/search', requireRole('admin', 'teacher', 'librarian'), libraryController.globalSearchDocuments);

// ==================== PREMIUM: LOANS BREAKDOWN ====================
router.get('/loans/breakdown', requireRole('admin', 'librarian'), libraryController.getLoansBreakdown);

export default router;
