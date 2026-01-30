"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, User, AlertTriangle, DollarSign, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchStudents, getActiveLoans, markBookLost, type Student, type BookLoan } from "@/lib/api/library";
import { toast } from "sonner";

export default function LostBooksPage() {
  const { user } = useAuth();
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeLoans, setActiveLoans] = useState<BookLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<BookLoan | null>(null);
  const [replacementCost, setReplacementCost] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Search states
  const [students, setStudents] = useState<Student[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

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

  // Load active loans for selected student
  const loadActiveLoans = async (studentId: string) => {
    if (!user?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsLoadingLoans(true);
    try {
      const result = await getActiveLoans(studentId, user.access_token);
      if (result.success && result.data) {
        setActiveLoans(result.data);
      } else {
        setActiveLoans([]);
      }
    } catch (error) {
      console.error('Error loading loans:', error);
      toast.error('Failed to load active loans');
    } finally {
      setIsLoadingLoans(false);
    }
  };

  // Mark book as lost
  const handleMarkLost = async () => {
    if (!selectedLoan) {
      toast.error('Please select a loan to mark as lost');
      return;
    }

    if (!replacementCost || parseFloat(replacementCost) <= 0) {
      toast.error('Please enter a valid replacement cost');
      return;
    }

    if (!user?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await markBookLost(selectedLoan.id, {
        replacement_cost: parseFloat(replacementCost),
        processing_fee: 10, // Default processing fee
        notes: notes.trim() || undefined
      }, user.access_token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark book as lost');
      }

      toast.success('Book marked as lost successfully!');

      // Refresh loans
      if (selectedStudent) {
        await loadActiveLoans(selectedStudent.id);
      }

      // Reset form
      setSelectedLoan(null);
      setReplacementCost("");
      setNotes("");

    } catch (error: any) {
      console.error('Error marking book as lost:', error);
      toast.error(error.message || 'Failed to mark book as lost');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill replacement cost from book purchase price
  useEffect(() => {
    if (selectedLoan?.book_price) {
      setReplacementCost(selectedLoan.book_price.toString());
    }
  }, [selectedLoan]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">Lost Books</h1>
          <p className="text-muted-foreground">Mark books as lost and calculate replacement costs</p>
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
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">Selected Student</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  {selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.admission_number})
                </p>
                <Badge variant="outline" className="mt-2">
                  {activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}
                </Badge>
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
                      loadActiveLoans(student.id);
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

        {/* Active Loans */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Active Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLoans ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading loans...</p>
              </div>
            ) : activeLoans.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active loans found</p>
                {selectedStudent && (
                  <p className="text-sm text-muted-foreground mt-1">
                    This student has no books currently issued.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedLoan?.id === loan.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedLoan(loan)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {loan.book_title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Copy: {loan.accession_number}
                        </p>
                      </div>
                      <Badge variant="outline">
                        Active
                      </Badge>
                    </div>

                    <div className="mt-3 text-sm text-muted-foreground">
                      Due: {new Date(loan.due_date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mark Lost Details */}
      {selectedLoan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Mark Book as Lost
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Book Details */}
            <div className="p-4 bg-gray-50 border rounded-lg">
              <h4 className="font-medium mb-2">Book Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Title:</strong> {selectedLoan.book_title}</p>
                </div>
                <div>
                  <p><strong>Copy:</strong> {selectedLoan.accession_number}</p>
                  <p><strong>Due Date:</strong> {new Date(selectedLoan.due_date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="replacement-cost">Replacement Cost ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="replacement-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={replacementCost}
                    onChange={(e) => setReplacementCost(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Original purchase price: ${selectedLoan.book_price || 'N/A'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="Reason for marking as lost..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Warning */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">Important Notice</span>
              </div>
              <p className="text-sm text-red-700">
                Marking a book as lost will:
              </p>
              <ul className="text-sm text-red-700 mt-1 ml-4 list-disc">
                <li>Charge the student the replacement cost as a fine</li>
                <li>Remove the book copy from circulation</li>
                <li>Close the current loan</li>
              </ul>
              <p className="text-sm text-red-700 mt-2">
                This action cannot be undone. Make sure the book is truly lost before proceeding.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedLoan(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleMarkLost}
                disabled={isLoading || !replacementCost}
                className="min-w-32"
              >
                {isLoading ? 'Processing...' : 'Mark as Lost'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}