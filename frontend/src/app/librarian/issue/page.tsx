"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, User, Calendar, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchStudents, issueBook, type Student, type BookCopy } from "@/lib/api/library";
import { toast } from "sonner";

interface BookWithCopies {
  id: string;
  title: string;
  author: string;
  available_copies: number;
  copies: BookCopy[];
}

export default function IssueBookPage() {
  const { user } = useAuth();
  const [studentSearch, setStudentSearch] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedBook, setSelectedBook] = useState<BookWithCopies | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(null);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14); // Default 14 days
    return date.toISOString().split('T')[0];
  });
  const [isLoading, setIsLoading] = useState(false);

  // Search states
  const [students, setStudents] = useState<Student[]>([]);
  const [books, setBooks] = useState<BookWithCopies[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);

  // Search students
  const handleStudentSearch = async (query: string) => {
    if (!query.trim()) {
      setStudents([]);
      return;
    }

    if (!user?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsSearchingStudents(true);
    try {
      const result = await searchStudents(query, user.access_token);
      if (result.success && result.data) {
        setStudents(result.data);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error searching students:', error);
      toast.error('Failed to search students');
    } finally {
      setIsSearchingStudents(false);
    }
  };

  // Search books with available copies
  const handleBookSearch = async (query: string) => {
    if (!query.trim()) {
      setBooks([]);
      return;
    }

    if (!user?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsSearchingBooks(true);
    try {
      // Import getBooks from library API
      const { getBooks } = await import('@/lib/api/library');
      const result = await getBooks(user.access_token);
      
      if (result.success && result.data) {
        // Filter books with available copies and match search query
        const filteredBooks = result.data
          .filter(book => 
            book.available_copies > 0 &&
            (book.title.toLowerCase().includes(query.toLowerCase()) ||
             book.author.toLowerCase().includes(query.toLowerCase()))
          )
          .map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            available_copies: book.available_copies,
            copies: [] // Will be populated when book is selected
          }));

        setBooks(filteredBooks);
      } else {
        setBooks([]);
      }
    } catch (error) {
      console.error('Error searching books:', error);
      toast.error('Failed to search books');
    } finally {
      setIsSearchingBooks(false);
    }
  };

  // Issue book
  const handleIssueBook = async () => {
    if (!selectedStudent || !selectedCopy) {
      toast.error('Please select both student and book copy');
      return;
    }

    if (!user?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await issueBook({
        copyId: selectedCopy.id,
        student_id: selectedStudent.id,
        due_date: new Date(dueDate)
      }, user.access_token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to issue book');
      }

      toast.success('Book issued successfully!');

      // Reset form
      setSelectedStudent(null);
      setSelectedBook(null);
      setSelectedCopy(null);
      setStudentSearch("");
      setBookSearch("");
      setStudents([]);
      setBooks([]);

    } catch (error: any) {
      console.error('Error issuing book:', error);
      toast.error(error.message || 'Failed to issue book');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">Issue Book</h1>
          <p className="text-muted-foreground">Issue books to students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Student
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-search">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-search"
                  placeholder="Enter student name or ID..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    handleStudentSearch(e.target.value);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {selectedStudent && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">Selected Student</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.admission_number})
                </p>
              </div>
            )}

            {students.length > 0 && !selectedStudent && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedStudent(student);
                      setStudents([]);
                      setStudentSearch(`${student.first_name} ${student.last_name}`);
                    }}
                  >
                    <p className="font-medium">{student.first_name} {student.last_name}</p>
                    <p className="text-sm text-muted-foreground">ID: {student.admission_number}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Book Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Select Book
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="book-search">Search Book</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="book-search"
                  placeholder="Enter book title or author..."
                  value={bookSearch}
                  onChange={(e) => {
                    setBookSearch(e.target.value);
                    handleBookSearch(e.target.value);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {selectedBook && selectedCopy && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Selected Book</span>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  {selectedBook.title} by {selectedBook.author}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Copy: {selectedCopy.accession_number}
                </p>
              </div>
            )}

            {books.length > 0 && !selectedBook && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={async () => {
                      setSelectedBook(book);
                      setBooks([]);
                      setBookSearch(book.title);
                      
                      // Fetch available copies for the selected book
                      if (user?.access_token) {
                        try {
                          const { getAvailableCopies } = await import('@/lib/api/library');
                          const result = await getAvailableCopies(book.id, user.access_token);
                          if (result.success && result.data && result.data.length > 0) {
                            book.copies = result.data;
                            setSelectedCopy(result.data[0]);
                          } else {
                            toast.error('No available copies found for this book');
                          }
                        } catch (error) {
                          console.error('Error fetching copies:', error);
                          toast.error('Failed to fetch available copies');
                        }
                      }
                    }}
                  >
                    <p className="font-medium">{book.title}</p>
                    <p className="text-sm text-muted-foreground">by {book.author}</p>
                    <Badge variant="secondary" className="mt-1">
                      {book.available_copies} available
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {selectedBook && selectedBook.copies.length > 1 && (
              <div className="space-y-2">
                <Label>Select Copy</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedBook.copies.map((copy) => (
                    <Button
                      key={copy.id}
                      variant={selectedCopy?.id === copy.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCopy(copy)}
                    >
                      {copy.accession_number}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issue Details */}
      {(selectedStudent || selectedBook) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Issue Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {(!selectedStudent || !selectedCopy) && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Please select both a student and a book copy to proceed.
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleIssueBook}
                disabled={!selectedStudent || !selectedCopy || isLoading}
                className="min-w-32"
              >
                {isLoading ? 'Issuing...' : 'Issue Book'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}