"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, User, Calendar, AlertTriangle, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchStudents, getActiveLoans, returnBook, type Student, type BookLoan } from "@/lib/api/library";
import { getLoanDisplayStatus, getDaysOverdue } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminReturnBookPage() {
    const { user } = useAuth();
    const [studentSearch, setStudentSearch] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [activeLoans, setActiveLoans] = useState<BookLoan[]>([]);
    const [selectedLoan, setSelectedLoan] = useState<BookLoan | null>(null);
    const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [isLoading, setIsLoading] = useState(false);

    const [students, setStudents] = useState<Student[]>([]);
    const [isSearchingStudents, setIsSearchingStudents] = useState(false);
    const [isLoadingLoans, setIsLoadingLoans] = useState(false);

    const handleStudentSearch = async (query: string) => {
        if (!query.trim()) { setStudents([]); return; }
        if (!user?.access_token) { toast.error('Authentication required'); return; }
        setIsSearchingStudents(true);
        try {
            const result = await searchStudents(query, user.access_token);
            setStudents(result.success && result.data ? result.data : []);
        } catch {
            toast.error('Failed to search students');
        } finally {
            setIsSearchingStudents(false);
        }
    };

    const loadActiveLoans = async (studentId: string) => {
        if (!user?.access_token) { toast.error('Authentication required'); return; }
        setIsLoadingLoans(true);
        try {
            const result = await getActiveLoans(studentId, user.access_token);
            setActiveLoans(result.success && result.data ? result.data : []);
        } catch {
            toast.error('Failed to load active loans');
        } finally {
            setIsLoadingLoans(false);
        }
    };

    const handleReturnBook = async () => {
        if (!selectedLoan) { toast.error('Please select a loan to return'); return; }
        if (!user?.access_token) { toast.error('Authentication required'); return; }
        setIsLoading(true);
        try {
            const result = await returnBook(selectedLoan.id, { return_condition: 'good', collected_amount: 0 }, user.access_token);
            if (!result.success) throw new Error(result.error || 'Failed to return book');
            toast.success('Book returned successfully!');
            if (selectedStudent) await loadActiveLoans(selectedStudent.id);
            setSelectedLoan(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to return book');
        } finally {
            setIsLoading(false);
        }
    };

    const calculateFine = (loan: BookLoan) => {
        const days = getDaysOverdue(loan.due_date);
        return days > 0 ? days * 0.50 : 0;
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Return Book</h1>
                <p className="text-muted-foreground">Return books and calculate fines</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Select Student</CardTitle>
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
                                    onChange={(e) => { setStudentSearch(e.target.value); handleStudentSearch(e.target.value); }}
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
                                <p className="text-sm text-green-700 mt-1">{selectedStudent.first_name} {selectedStudent.last_name} ({selectedStudent.admission_number})</p>
                                <Badge variant="outline" className="mt-2">{activeLoans.length} active loan{activeLoans.length !== 1 ? 's' : ''}</Badge>
                            </div>
                        )}
                        {students.length > 0 && !selectedStudent && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {students.map((s) => (
                                    <div key={s.id} className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                                        onClick={() => { setSelectedStudent(s); setStudents([]); setStudentSearch(`${s.first_name} ${s.last_name}`); loadActiveLoans(s.id); }}>
                                        <p className="font-medium">{s.first_name} {s.last_name}</p>
                                        <p className="text-sm text-muted-foreground">ID: {s.admission_number}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Active Loans</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingLoans ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                                <p className="text-sm text-muted-foreground mt-2">Loading loans...</p>
                            </div>
                        ) : activeLoans.length === 0 ? (
                            <div className="text-center py-8">
                                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">No active loans found</p>
                                {selectedStudent && <p className="text-sm text-muted-foreground mt-1">This student has no books currently issued.</p>}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeLoans.map((loan) => {
                                    const displayStatus = getLoanDisplayStatus(loan);
                                    const fine = calculateFine(loan);
                                    return (
                                        <div key={loan.id}
                                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedLoan?.id === loan.id ? 'border-primary bg-primary/5' : 'hover:bg-gray-50'}`}
                                            onClick={() => setSelectedLoan(loan)}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-medium">{loan.book_title}</h4>
                                                    <p className="text-xs text-muted-foreground">Copy: {loan.accession_number}</p>
                                                </div>
                                                <Badge variant={displayStatus.color as any}>{displayStatus.status}</Badge>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between text-sm">
                                                <span>Due: {new Date(loan.due_date).toLocaleDateString()}</span>
                                                {fine > 0 && (
                                                    <div className="flex items-center gap-1 text-red-600">
                                                        <DollarSign className="h-3 w-3" />
                                                        <span>${fine.toFixed(2)} fine</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {selectedLoan && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Return Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="return-date">Return Date</Label>
                                <Input id="return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                            </div>
                        </div>
                        {(() => {
                            const fine = calculateFine(selectedLoan);
                            const days = getDaysOverdue(selectedLoan.due_date);
                            return fine > 0 ? (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                        <span className="font-medium text-red-800">Overdue Book</span>
                                    </div>
                                    <p className="text-sm text-red-700">This book is {days} day{days !== 1 ? 's' : ''} overdue.</p>
                                    <p className="text-sm font-medium text-red-800 mt-1">Fine: ${fine.toFixed(2)}</p>
                                </div>
                            ) : (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-green-600" />
                                        <span className="font-medium text-green-800">On Time Return</span>
                                    </div>
                                    <p className="text-sm text-green-700">This book is being returned on time. No fine will be charged.</p>
                                </div>
                            );
                        })()}
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setSelectedLoan(null)}>Cancel</Button>
                            <Button onClick={handleReturnBook} disabled={isLoading} className="min-w-32">
                                {isLoading ? 'Returning...' : 'Return Book'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
