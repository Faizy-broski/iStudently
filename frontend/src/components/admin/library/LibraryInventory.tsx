"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Search, Layers, Barcode, Users, FileText, AlertTriangle, CheckCircle, Zap, Upload, ImageIcon, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getBooks, deleteBook, type Book } from "@/lib/api/library";
import { LibraryCategory } from "@/types";
import { AddBookDialog } from "./AddBookDialog";
import { EditBookDialog } from "./EditBookDialog";
import { AddCopiesDialog } from "./AddCopiesDialog";
import { IssueBookDialog } from "./IssueBookDialog";
import { ReturnBookDialog } from "./ReturnBookDialog";
import { MarkLostDialog } from "./MarkLostDialog";
import { CategorySidebar } from "./CategorySidebar";
import { QuickLoanDialog } from "./QuickLoanDialog";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function LibraryInventory() {
  const t = useTranslations("admin.library.inventory");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);

  // Modal states
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [showEditBookDialog, setShowEditBookDialog] = useState(false);
  const [showAddCopiesDialog, setShowAddCopiesDialog] = useState(false);
  const [showIssueBookDialog, setShowIssueBookDialog] = useState(false);
  const [showReturnBookDialog, setShowReturnBookDialog] = useState(false);
  const [returnBook, setReturnBook] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false);
  const [showQuickLoanDialog, setShowQuickLoanDialog] = useState(false);
  const [showUploadDocumentDialog, setShowUploadDocumentDialog] = useState(false);

  // Load books on component mount
  useEffect(() => {
    loadBooks();
  }, []);

  // Filter books based on search query AND selected category
  useEffect(() => {
    let result = books;

    // Category filter
    if (selectedCategoryId) {
      result = result.filter((book) => book.category_id === selectedCategoryId);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (book) =>
          book.title.toLowerCase().includes(q) ||
          book.author.toLowerCase().includes(q) ||
          (book.isbn && book.isbn.toLowerCase().includes(q)) ||
          (book.reference && book.reference.toLowerCase().includes(q))
      );
    }

    setFilteredBooks(result);
  }, [books, searchQuery, selectedCategoryId]);

  const loadBooks = async () => {
    if (!user?.access_token) return;

    try {
      setIsLoading(true);
      const response = await getBooks(user.access_token);
      if (response.success && response.data) {
        setBooks(response.data);
      } else {
        toast.error(response.error || t("toast.load_failed"));
      }
    } catch (error) {
      console.error("Error loading books:", error);
      toast.error(t("toast.load_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookAdded = () => {
    loadBooks();
    setShowAddBookDialog(false);
  };

  const handleBookUpdated = () => {
    loadBooks();
  };

  const openEditBook = (book: Book) => {
    setSelectedBook(book);
    setShowEditBookDialog(true);
  };

  const handleCopiesAdded = () => {
    loadBooks();
    setShowAddCopiesDialog(false);
    setSelectedBook(null);
  };

  const handleBookIssued = () => {
    loadBooks();
    setShowIssueBookDialog(false);
    setSelectedBook(null);
  };

  const handleBookReturned = () => {
    loadBooks();
    setShowReturnBookDialog(false);
  };

  const handleBookMarkedLost = () => {
    loadBooks();
    setShowMarkLostDialog(false);
  };

  const handleQuickLoanCreated = () => {
    loadBooks();
    setShowQuickLoanDialog(false);
  };

  const handleDocumentUploaded = () => {
    loadBooks();
  };

  const openAddCopies = (book: Book) => {
    setSelectedBook(book);
    setShowAddCopiesDialog(true);
  };

  const openIssueBook = (book: Book) => {
    setSelectedBook(book);
    setShowIssueBookDialog(true);
  };

  const openReturnBook = (book: Book) => {
    setReturnBook(book);
    setShowReturnBookDialog(true);
  };

  const openMarkLost = () => {
    setShowMarkLostDialog(true);
  };

  const handleDeleteBook = async () => {
    if (!deleteTarget || !user?.access_token) return;
    setIsDeleting(true);
    try {
      const res = await deleteBook(deleteTarget.id, user.access_token);
      if (res.success) {
        toast.success(`"${deleteTarget.title}" deleted successfully`);
        setDeleteTarget(null);
        loadBooks();
      } else {
        toast.error(res.error || 'Failed to delete book');
      }
    } catch {
      toast.error('Failed to delete book');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.color_code || null;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((c) => c.id === categoryId)?.name || null;
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-w-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setShowQuickLoanDialog(true)}
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
          >
            <Zap className="mr-2 h-4 w-4" />
            {t("actions.quick_loan")}
          </Button>
          <Button
            onClick={() => setShowUploadDocumentDialog(true)}
            variant="outline"
            className="border-[#57A3CC] text-[#022172] hover:bg-[#57A3CC]/10"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("actions.upload_document")}
          </Button>
          <Button onClick={() => setShowAddBookDialog(true)} className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" />
            {t("actions.add_book")}
          </Button>
        </div>
      </div>

      {/* Categories on top */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <CategorySidebar
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            onCategoriesChange={setCategories}
          />
        </CardContent>
      </Card>

      {/* Search */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Book List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t("documents_count", { count: filteredBooks.length })}
                {selectedCategoryId && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {getCategoryName(selectedCategoryId)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  {t("loading_books")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full w-full divide-y divide-muted">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">{t("table.cover")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.title")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.author")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.ref_isbn")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("table.copies")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tCommon("status")}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tCommon("actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-muted">
                      {filteredBooks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            {searchQuery ? t("no_books_search") : t("no_books")}
                          </td>
                        </tr>
                      ) : (
                        filteredBooks.map((book) => {
                          const catColor = getCategoryColor(book.category_id);
                          return (
                            <tr key={book.id} className="hover:bg-muted/50 transition-colors">
                              <td className="px-4 py-2">
                                <div className="w-9 h-12 rounded overflow-hidden border bg-muted/40 flex items-center justify-center shrink-0">
                                  {book.cover_image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={book.cover_image_url}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 max-w-[200px] md:max-w-[300px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  {catColor && (
                                    <div
                                      className="h-2.5 w-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: catColor }}
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-foreground truncate" title={book.title}>{book.title}</div>
                                    {book.document_type && book.document_type !== "book" && (
                                      <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">
                                        {book.document_type}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground max-w-[150px] truncate" title={book.author}>
                                {book.author}
                              </td>
                              <td className="px-4 py-4 text-sm font-mono text-muted-foreground max-w-[150px] truncate" title={book.reference || book.isbn || tCommon("na")}>
                                {book.reference || book.isbn || tCommon("na")}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                {book.available_copies} / {book.total_copies}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge
                                  variant={book.available_copies > 0 ? "default" : "destructive"}
                                  className={cn(
                                    book.available_copies > 0
                                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                                      : "bg-red-100 text-red-800 hover:bg-red-100"
                                  )}
                                >
                                  {book.available_copies > 0 ? (
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                  )}
                                  {book.available_copies > 0 ? t("status.available") : t("status.unavailable")}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <TooltipProvider delayDuration={200}>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="outline" onClick={() => openEditBook(book)} className="h-8 w-8">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{tCommon("edit")}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="outline" onClick={() => openAddCopies(book)} className="h-8 w-8">
                                          <Layers className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("actions.add_copies")}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="outline" onClick={() => openIssueBook(book)} disabled={book.available_copies === 0} className="h-8 w-8">
                                          <Barcode className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("actions.issue")}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="outline" onClick={() => openReturnBook(book)} className="h-8 w-8">
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("actions.return")}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="destructive" onClick={openMarkLost} className="h-8 w-8">
                                          <Users className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("actions.lost")}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="destructive" onClick={() => setDeleteTarget(book)} className="h-8 w-8 bg-red-700 hover:bg-red-800">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete Book</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TooltipProvider>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
      {/* Modals */}
      <AddBookDialog
        open={showAddBookDialog}
        onOpenChange={setShowAddBookDialog}
        onBookAdded={handleBookAdded}
      />

      <EditBookDialog
        open={showEditBookDialog}
        onOpenChange={setShowEditBookDialog}
        book={selectedBook}
        onBookUpdated={handleBookUpdated}
      />

      <AddCopiesDialog
        open={showAddCopiesDialog}
        onOpenChange={setShowAddCopiesDialog}
        book={selectedBook}
        onCopiesAdded={handleCopiesAdded}
      />

      <IssueBookDialog
        open={showIssueBookDialog}
        onOpenChange={setShowIssueBookDialog}
        book={selectedBook}
        onBookIssued={handleBookIssued}
      />

      <ReturnBookDialog
        open={showReturnBookDialog}
        onOpenChange={(o) => { setShowReturnBookDialog(o); if (!o) setReturnBook(null); }}
        onBookReturned={handleBookReturned}
        prefilledBook={returnBook}
      />

      <MarkLostDialog
        open={showMarkLostDialog}
        onOpenChange={setShowMarkLostDialog}
        onBookMarkedLost={handleBookMarkedLost}
      />

      <QuickLoanDialog
        open={showQuickLoanDialog}
        onOpenChange={setShowQuickLoanDialog}
        onLoanCreated={handleQuickLoanCreated}
      />

      <UploadDocumentDialog
        open={showUploadDocumentDialog}
        onOpenChange={setShowUploadDocumentDialog}
        onDocumentUploaded={handleDocumentUploaded}
        preselectedCategoryId={selectedCategoryId}
      />

      {/* Delete Book Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>?
              This will permanently remove it from the library and the E-Library.
              {(deleteTarget?.total_copies ?? 0) > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠ This book has {deleteTarget?.total_copies} copies. Delete all copies first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              disabled={isDeleting || (deleteTarget?.total_copies ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
