"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Search, Layers, Barcode, Users, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getBooks, type Book } from "@/lib/api/library";
import { AddBookDialog } from "./AddBookDialog";
import { AddCopiesDialog } from "./AddCopiesDialog";
import { IssueBookDialog } from "./IssueBookDialog";
import { ReturnBookDialog } from "./ReturnBookDialog";
import { MarkLostDialog } from "./MarkLostDialog";
import { toast } from "sonner";

export function LibraryInventory() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Modal states
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [showAddCopiesDialog, setShowAddCopiesDialog] = useState(false);
  const [showIssueBookDialog, setShowIssueBookDialog] = useState(false);
  const [showReturnBookDialog, setShowReturnBookDialog] = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false);

  // Load books on component mount
  useEffect(() => {
    loadBooks();
  }, []);

  // Filter books based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredBooks(books);
    } else {
      const filtered = books.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredBooks(filtered);
    }
  }, [books, searchQuery]);

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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Library Inventory
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Manage books, copies, and circulation
          </p>
        </div>
        <Button onClick={() => setShowAddBookDialog(true)} className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add Book
        </Button>
      </div>

      {/* Search */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, author, ISBN..."
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
            Books ({filteredBooks.length})
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">ISBN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copies</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available</th>
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
                    filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-medium text-foreground">{book.title}</div>
                          {book.category && (
                            <div className="text-sm text-muted-foreground">{book.category}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {book.author}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-muted-foreground">
                          {book.isbn || "N/A"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          {book.total_copies}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          {book.available_copies}
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
                    ))
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
    </div>
  );
}
