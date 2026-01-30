'use client';

import Link from 'next/link'
import {
    BookOpen,
    AlertTriangle,
    ArrowUpRight,
    Search,
    Plus,
    Loader2,
    Clock,
    RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useLibrarianDashboard } from '@/hooks/useLibrarianDashboard'

export default function LibrarianDashboard() {
    const { stats, loading, error, refreshDashboard, isValidating } = useLibrarianDashboard()

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
                <p className="text-sm text-gray-500">Loading dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
                <div className="text-center">
                    <p className="text-red-600 font-semibold mb-2">Failed to load dashboard</p>
                    <p className="text-sm text-gray-500 mb-4">{error}</p>
                    <button
                        onClick={() => refreshDashboard()}
                        className="px-4 py-2 bg-[#022172] text-white rounded-lg hover:bg-[#022172]/90 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Page Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#022172]">
                        Welcome back, <span className="text-[#57A3CC]">Librarian</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage library operations and track book circulation.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshDashboard()}
                    disabled={isValidating}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
                <Link href="/librarian/books">
                    <Button className="bg-gradient-to-r from-[#57A3CC] to-[#022172]">
                        <Plus className="mr-2 h-4 w-4" /> Issue Book
                    </Button>
                </Link>
                <Link href="/librarian/books">
                    <Button variant="outline" className="text-[#022172] border-[#022172]/20">
                        <ArrowUpRight className="mr-2 h-4 w-4" /> Return Book
                    </Button>
                </Link>
                <Link href="/librarian/books">
                    <Button variant="outline" className="text-[#022172] border-[#022172]/20">
                        <Search className="mr-2 h-4 w-4" /> Search Books
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Books</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#022172]">{stats?.total_books?.toLocaleString() || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">{stats?.total_copies || 0} copies total</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-amber-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Active Loans</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#022172]">{stats?.active_loans || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Across all students</p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Overdue Books</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats?.overdue_loans || 0}</div>
                        {(stats?.overdue_loans || 0) > 0 && (
                            <p className="text-xs text-red-600 mt-1">Action required</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Fines Collected</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-[#022172]">${stats?.total_fines_collected?.toFixed(2) || '0.00'}</div>
                        {(stats?.pending_fines || 0) > 0 && (
                            <p className="text-xs text-amber-600 mt-1">${stats?.pending_fines?.toFixed(2)} pending</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-[#022172]">Recent Loans</CardTitle>
                        <CardDescription>Latest books issued to students</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats?.recent_loans && stats.recent_loans.length > 0 ? (
                            <div className="space-y-3">
                                {stats.recent_loans.map((loan) => (
                                    <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">{loan.book_title}</p>
                                            <p className="text-xs text-gray-500">
                                                Due: {new Date(loan.due_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded font-medium ${loan.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {loan.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 text-center py-8">
                                No recent loans to display.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[#022172]">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Overdue Returns
                        </CardTitle>
                        <CardDescription>Books past their due date</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats?.overdue_list && stats.overdue_list.length > 0 ? (
                            <div className="space-y-3">
                                {stats.overdue_list.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">{item.book_title}</p>
                                            <p className="text-xs text-gray-600">{item.student_name}</p>
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">
                                            <Clock className="h-3 w-3 inline mr-1" />
                                            {item.days_overdue} days
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 text-center py-8">
                                No overdue books. Great job! 🎉
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
