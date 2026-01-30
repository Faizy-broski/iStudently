'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import { Search, Loader2, Filter, AlertTriangle, BookOpen, Clock } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'

interface Loan {
    id: string;
    book_copy_id: string;
    student_id: string;
    school_id: string;
    issue_date: string;
    due_date: string;
    return_date: string | null;
    status: 'active' | 'returned' | 'lost' | 'overdue';
    fine_amount: number;
    collected_amount: number;
    notes: string | null;
    book_title: string;
    student_name: string;
    student_number: string;
    accession_number: string;
}

const ITEMS_PER_PAGE = 10;

export default function LoanDirectoryPage() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchLoans();
    }, [statusFilter]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter]);

    const fetchLoans = async () => {
        try {
            setLoading(true);
            const token = await getAuthToken();

            // Build query params
            const params = new URLSearchParams();
            if (statusFilter && statusFilter !== 'all') {
                if (statusFilter === 'overdue') {
                    params.append('status', 'active');
                } else {
                    params.append('status', statusFilter);
                }
            }

            const response = await fetch(`${API_URL}/library/loans?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();

            if (data.success) {
                let fetchedLoans = data.data || [];

                // Filter for overdue if needed
                if (statusFilter === 'overdue') {
                    const today = new Date();
                    fetchedLoans = fetchedLoans.filter((loan: Loan) => {
                        const dueDate = new Date(loan.due_date);
                        return loan.status === 'active' && dueDate < today;
                    });
                }

                setLoans(fetchedLoans);
            } else {
                setError(data.error || 'Failed to load loans');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load loans');
        } finally {
            setLoading(false);
        }
    };

    // Filter loans by search
    const filteredLoans = loans.filter(loan => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            loan.book_title?.toLowerCase().includes(searchLower) ||
            loan.student_name?.toLowerCase().includes(searchLower) ||
            loan.student_number?.toLowerCase().includes(searchLower) ||
            loan.accession_number?.toLowerCase().includes(searchLower)
        );
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredLoans.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedLoans = filteredLoans.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const getStatusBadge = (loan: Loan) => {
        const today = new Date();
        const dueDate = new Date(loan.due_date);
        const isOverdue = loan.status === 'active' && dueDate < today;

        if (isOverdue) {
            return <Badge variant="destructive">Overdue</Badge>;
        }

        switch (loan.status) {
            case 'active':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Active</Badge>;
            case 'returned':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Returned</Badge>;
            case 'lost':
                return <Badge variant="destructive">Lost</Badge>;
            default:
                return <Badge variant="secondary">{loan.status}</Badge>;
        }
    };

    const getDaysOverdue = (dueDate: string) => {
        const today = new Date();
        const due = new Date(dueDate);
        if (due >= today) return 0;
        return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Generate pagination items
    const getPaginationItems = () => {
        const items = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                items.push(i);
            }
        } else {
            if (currentPage <= 3) {
                items.push(1, 2, 3, 4, 'ellipsis', totalPages);
            } else if (currentPage >= totalPages - 2) {
                items.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                items.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
            }
        }

        return items;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#022172]">Loan Directory</h1>
                <p className="text-gray-500 mt-1">View and manage all book loans</p>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by book, student name, student ID, or accession #..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Loans</SelectItem>
                                <SelectItem value="active">Active / Issued</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="returned">Returned</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={fetchLoans}>
                            Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-gray-500">Active</span>
                        </div>
                        <p className="text-xl font-bold text-[#022172] mt-1">
                            {loans.filter(l => l.status === 'active').length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-gray-500">Overdue</span>
                        </div>
                        <p className="text-xl font-bold text-red-600 mt-1">
                            {loans.filter(l => {
                                const dueDate = new Date(l.due_date);
                                return l.status === 'active' && dueDate < new Date();
                            }).length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-gray-500">Returned</span>
                        </div>
                        <p className="text-xl font-bold text-[#022172] mt-1">
                            {loans.filter(l => l.status === 'returned').length}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-gray-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-500">Lost</span>
                        </div>
                        <p className="text-xl font-bold text-[#022172] mt-1">
                            {loans.filter(l => l.status === 'lost').length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Loans Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-600">
                            <p>{error}</p>
                            <Button variant="outline" className="mt-4" onClick={fetchLoans}>
                                Try Again
                            </Button>
                        </div>
                    ) : filteredLoans.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No loans found matching your criteria.</p>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Book Title</TableHead>
                                        <TableHead>Accession #</TableHead>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead>Issue Date</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Days Overdue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedLoans.map((loan) => {
                                        const daysOverdue = getDaysOverdue(loan.due_date);
                                        const isOverdue = loan.status === 'active' && daysOverdue > 0;

                                        return (
                                            <TableRow key={loan.id} className={isOverdue ? 'bg-red-50' : ''}>
                                                <TableCell className="font-medium">{loan.book_title}</TableCell>
                                                <TableCell>{loan.accession_number}</TableCell>
                                                <TableCell>{loan.student_number || 'N/A'}</TableCell>
                                                <TableCell>{loan.student_name}</TableCell>
                                                <TableCell>{new Date(loan.issue_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{new Date(loan.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{getStatusBadge(loan)}</TableCell>
                                                <TableCell>
                                                    {isOverdue ? (
                                                        <span className="text-red-600 font-medium">{daysOverdue} days</span>
                                                    ) : loan.status === 'active' ? (
                                                        <span className="text-gray-400">-</span>
                                                    ) : (
                                                        <span className="text-gray-400">N/A</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-4 border-t">
                                    <p className="text-sm text-gray-500">
                                        Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredLoans.length)} of {filteredLoans.length} loans
                                    </p>
                                    <Pagination>
                                        <PaginationContent>
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                                                    }}
                                                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                                />
                                            </PaginationItem>

                                            {getPaginationItems().map((item, index) => (
                                                <PaginationItem key={index}>
                                                    {item === 'ellipsis' ? (
                                                        <PaginationEllipsis />
                                                    ) : (
                                                        <PaginationLink
                                                            href="#"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setCurrentPage(item as number);
                                                            }}
                                                            isActive={currentPage === item}
                                                            className="cursor-pointer"
                                                        >
                                                            {item}
                                                        </PaginationLink>
                                                    )}
                                                </PaginationItem>
                                            ))}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                                                    }}
                                                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
