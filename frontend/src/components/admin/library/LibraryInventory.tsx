"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Search, Layers, Barcode, Users, FileText, AlertTriangle, CheckCircle, Zap, Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getBooks, type Book } from "@/lib/api/library";
import { LibraryCategory } from "@/types";
import { AddBookDialog } from "./AddBookDialog";
import { AddCopiesDialog } from "./AddCopiesDialog";
import { IssueBookDialog } from "./IssueBookDialog";
import { ReturnBookDialog } from "./ReturnBookDialog";
import { MarkLostDialog } from "./MarkLostDialog";
import { CategorySidebar } from "./CategorySidebar";
import { QuickLoanDialog } from "./QuickLoanDialog";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { toast } from "sonner";

export function LibraryInventory() {
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
  const [showAddCopiesDialog, setShowAddCopiesDialog] = useState(false);
  const [showIssueBookDialog, setShowIssueBookDialog] = useState(false);
  const [showReturnBookDialog, setShowReturnBookDialog] = useState(false);
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
        toast.error(response.error || "Failed to load books");
      }
    } catch (error) {
      console.error("Error loading books:", error);
      toast.error("Failed to load books");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookAdded = () => {
    loadBooks();
    setShowAddBookDialog(false);
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

  const openReturnBook = () => {
    setShowReturnBookDialog(true);
  };

  const openMarkLost = () => {
    setShowMarkLostDialog(true);
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
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Category Sidebar */}
        <div className="w-full md:w-56 shrink-0">
          <Card className="shadow-sm sticky top-4">
            <CardContent className="p-3">
              <CategorySidebar
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={setSelectedCategoryId}
                onCategoriesChange={setCategories}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                Library Inventory
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-2">
                Manage books, copies, and circulation
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setShowQuickLoanDialog(true)}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              >
                <Zap className="mr-2 h-4 w-4" />
                Quick Loan
              </Button>
              <Button
                onClick={() => setShowUploadDocumentDialog(true)}
                variant="outline"
                className="border-[#57A3CC] text-[#022172] hover:bg-[#57A3CC]/10"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
              <Button onClick={() => setShowAddBookDialog(true)} className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Add Book
              </Button>
            </div>
          </div>

          {/* Search */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by title, author, ISBN, reference..."
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
                Documents ({filteredBooks.length})
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
                  Loading books...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-muted">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">Cover</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Author</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ref / ISBN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copies</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-muted">
                      {filteredBooks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            {searchQuery ? "No books found matching your search." : "No books in the library yet."}
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
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {catColor && (
                                    <div
                                      className="h-2.5 w-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: catColor }}
                                    />
                                  )}
                                  <div>
                                    <div className="font-medium text-foreground">{book.title}</div>
                                    {book.document_type && book.document_type !== "book" && (
                                      <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">
                                        {book.document_type}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                {book.author}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground">
                                {book.reference || book.isbn || "N/A"}
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
                                  {book.available_copies > 0 ? "Available" : "Unavailable"}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openAddCopies(book)}
                                  className="h-8"
                                >
                                  <Layers className="h-3 w-3 mr-1" />
                                  Add Copies
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openIssueBook(book)}
                                  disabled={book.available_copies === 0}
                                  className="h-8"
                                >
                                  <Barcode className="h-3 w-3 mr-1" />
                                  Issue
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={openReturnBook}
                                  className="h-8"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={openMarkLost}
                                  className="h-8"
                                >
                                  <Users className="h-3 w-3 mr-1" />
                                  Lost
                                </Button>
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
        </div>
      </div>

      {/* Modals */}
      <AddBookDialog
        open={showAddBookDialog}
        onOpenChange={setShowAddBookDialog}
        onBookAdded={handleBookAdded}
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
        onOpenChange={setShowReturnBookDialog}
        onBookReturned={handleBookReturned}
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
    </div>
  );
}
