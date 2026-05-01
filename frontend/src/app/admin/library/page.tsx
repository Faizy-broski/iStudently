'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Info, Loader2, Search, Filter, AlertTriangle, BookOpen, Clock } from "lucide-react"
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { useCampus } from '@/context/CampusContext'
import { useTranslations } from 'next-intl'

interface LibraryStats {
  total_books: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  active_loans: number;
  overdue_loans: number;
  total_fines_collected: number;
  pending_fines: number;
}

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

export default function AdminLibraryPage() {
  const t = useTranslations('admin.library.overview')
  const { selectedCampus } = useCampus() || {};
  const campusId = selectedCampus?.id;

  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansLoading, setLoansLoading] = useState(true);
  const [loansError, setLoansError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);
        const token = await getAuthToken();
        const params = new URLSearchParams();
        if (campusId) params.append('campus_id', campusId);
        const res = await fetch(`${API_URL}/library/stats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) setStats(data.data);
        else setStatsError(data.error || t('errors.load_stats'));
      } catch (err: any) {
        setStatsError(err.message || t('errors.load_stats'));
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [campusId]);

  const fetchLoans = useCallback(async () => {
    try {
      setLoansLoading(true);
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (campusId) params.append('campus_id', campusId);
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter === 'overdue' ? 'active' : statusFilter);
      }
      const res = await fetch(`${API_URL}/library/loans?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        let fetched: Loan[] = data.data || [];
        if (statusFilter === 'overdue') {
          const today = new Date();
          fetched = fetched.filter(l => l.status === 'active' && new Date(l.due_date) < today);
        }
        setLoans(fetched);
      } else {
        setLoansError(data.error || t('errors.load_loans'));
      }
    } catch (err: any) {
      setLoansError(err.message || t('errors.load_loans'));
    } finally {
      setLoansLoading(false);
    }
  }, [campusId, statusFilter]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, campusId]);

  const filteredLoans = loans.filter(loan => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      loan.book_title?.toLowerCase().includes(s) ||
      loan.student_name?.toLowerCase().includes(s) ||
      loan.student_number?.toLowerCase().includes(s) ||
      loan.accession_number?.toLowerCase().includes(s)
    );
  });

  const totalPages = Math.ceil(filteredLoans.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLoans = filteredLoans.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusBadge = (loan: Loan) => {
    const isOverdue = loan.status === 'active' && new Date(loan.due_date) < new Date();
    if (isOverdue) return <Badge variant="destructive">{t('status.overdue')}</Badge>;
    switch (loan.status) {
      case 'active':   return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{t('status.active')}</Badge>;
      case 'returned': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t('status.returned')}</Badge>;
      case 'lost':     return <Badge variant="destructive">{t('status.lost')}</Badge>;
      default:         return <Badge variant="secondary">{loan.status}</Badge>;
    }
  };

  const getDaysOverdue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    if (due >= today) return 0;
    return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPaginationItems = () => {
    const items: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else if (currentPage <= 3) {
      items.push(1, 2, 3, 4, 'ellipsis', totalPages);
    } else if (currentPage >= totalPages - 2) {
      items.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      items.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
    }
    return items;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#022172] dark:text-white">{t('title')}</h1>
        <p className="text-gray-500 mt-1">
          {selectedCampus ? (
            <>{t('showing_for')} <span className="font-medium text-[#022172]">{selectedCampus.name}</span></>
          ) : (
            t('showing_all')
          )}
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t('moved_title')}</AlertTitle>
        <AlertDescription>
          {t('moved_desc_1')} <strong>{t('librarian_dashboard')}</strong>. {t('moved_desc_2')}
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
        </div>
      ) : statsError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('error')}</AlertTitle>
          <AlertDescription>{statsError}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">{t('cards.total_inventory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">{stats?.total_books || 0} {t('cards.books')}</div>
              <p className="text-xs text-gray-500 mt-1">{stats?.total_copies || 0} {t('cards.total_copies')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">{t('cards.current_circulation')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">{stats?.active_loans || 0} {t('cards.issued')}</div>
              {(stats?.overdue_loans || 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">{stats?.overdue_loans} {t('cards.overdue')}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">{t('cards.financials')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">${stats?.total_fines_collected?.toFixed(2) || '0.00'} {t('cards.collected')}</div>
              {(stats?.pending_fines || 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1">${stats?.pending_fines?.toFixed(2)} {t('cards.pending')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loan Directory */}
      <div>
        <h2 className="text-xl font-bold text-[#022172] dark:text-white mb-4">{t('loan_directory')}</h2>

        {/* Filters */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t('filters.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('filters.search_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-45">
                  <SelectValue placeholder={t('filters.status_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all_loans')}</SelectItem>
                  <SelectItem value="active">{t('filters.active_issued')}</SelectItem>
                  <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
                  <SelectItem value="returned">{t('status.returned')}</SelectItem>
                  <SelectItem value="lost">{t('status.lost')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchLoans}>{t('refresh')}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Loan Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-500">{t('status.active')}</span>
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
                <span className="text-sm text-gray-500">{t('status.overdue')}</span>
              </div>
              <p className="text-xl font-bold text-red-600 mt-1">
                {loans.filter(l => l.status === 'active' && new Date(l.due_date) < new Date()).length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-500">{t('status.returned')}</span>
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
                <span className="text-sm text-gray-500">{t('status.lost')}</span>
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
            {loansLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
              </div>
            ) : loansError ? (
              <div className="text-center py-12 text-red-600">
                <p>{loansError}</p>
                <Button variant="outline" className="mt-4" onClick={fetchLoans}>{t('try_again')}</Button>
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>{t('no_loans')}</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.book_title')}</TableHead>
                      <TableHead>{t('table.accession')}</TableHead>
                      <TableHead>{t('table.student_id')}</TableHead>
                      <TableHead>{t('table.student_name')}</TableHead>
                      <TableHead>{t('table.issue_date')}</TableHead>
                      <TableHead>{t('table.due_date')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                      <TableHead>{t('table.days_overdue')}</TableHead>
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
                          <TableCell>{loan.student_number || t('na')}</TableCell>
                          <TableCell>{loan.student_name}</TableCell>
                          <TableCell>{new Date(loan.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(loan.due_date).toLocaleDateString()}</TableCell>
                          <TableCell>{getStatusBadge(loan)}</TableCell>
                          <TableCell>
                            {isOverdue ? (
                              <span className="text-red-600 font-medium">{daysOverdue} {t('days')}</span>
                            ) : loan.status === 'active' ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <span className="text-gray-400">{t('na')}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t">
                    <p className="text-sm text-gray-500">
                      {t('showing', { start: startIndex + 1, end: Math.min(startIndex + ITEMS_PER_PAGE, filteredLoans.length), total: filteredLoans.length })}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {getPaginationItems().map((item, i) =>
                          item === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${i}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={item}>
                              <PaginationLink
                                onClick={() => setCurrentPage(item as number)}
                                isActive={currentPage === item}
                                className="cursor-pointer"
                              >
                                {item}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
    </div>
  );
}
