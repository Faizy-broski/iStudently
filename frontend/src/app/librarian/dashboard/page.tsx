'use client';

import { SetupAssistantPanel } from '@/components/setup-assistant/SetupAssistantPanel'
import Link from 'next/link'
import {
  BookOpen, AlertTriangle, ArrowUpRight, Search, Plus, Loader2,
  Clock, RefreshCw, BookMarked, Users, DollarSign, TrendingUp,
  CheckCircle2, BookX, Library, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLibrarianDashboard } from '@/hooks/useLibrarianDashboard'
import { useAuth } from '@/context/AuthContext'

export default function LibrarianDashboard() {
  const { stats, loading, error, refreshDashboard, isValidating } = useLibrarianDashboard()
  const { profile } = useAuth()
  const firstName = profile?.first_name || 'Librarian'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <BookX className="h-12 w-12 text-red-400" />
        <p className="text-red-600 font-semibold">Failed to load dashboard</p>
        <p className="text-sm text-gray-500">{error}</p>
        <Button onClick={() => refreshDashboard()} className="bg-[#022172] text-white">
          Try Again
        </Button>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Books',
      value: stats?.total_books?.toLocaleString() ?? '0',
      sub: `${stats?.total_copies ?? 0} copies`,
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      border: 'border-t-blue-500',
    },
    {
      label: 'Active Loans',
      value: stats?.active_loans ?? 0,
      sub: 'Currently issued',
      icon: BookMarked,
      color: 'from-amber-500 to-amber-600',
      border: 'border-t-amber-500',
    },
    {
      label: 'Overdue Books',
      value: stats?.overdue_loans ?? 0,
      sub: (stats?.overdue_loans ?? 0) > 0 ? 'Action required' : 'All on time',
      icon: Clock,
      color: (stats?.overdue_loans ?? 0) > 0 ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600',
      border: (stats?.overdue_loans ?? 0) > 0 ? 'border-t-red-500' : 'border-t-green-500',
      valueClass: (stats?.overdue_loans ?? 0) > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      label: 'Fines Collected',
      value: `$${stats?.total_fines_collected?.toFixed(2) ?? '0.00'}`,
      sub: stats?.pending_fines ? `$${stats.pending_fines.toFixed(2)} pending` : 'No pending fines',
      icon: DollarSign,
      color: 'from-emerald-500 to-emerald-600',
      border: 'border-t-emerald-500',
    },
  ]

  const quickActions = [
    { label: 'Issue Book', href: '/librarian/issue', icon: Plus, primary: true },
    { label: 'Return Book', href: '/librarian/return', icon: ArrowUpRight, primary: false },
    { label: 'Search Books', href: '/librarian/books', icon: Search, primary: false },
    { label: 'E-Library', href: '/librarian/e-library', icon: BookOpen, primary: false },
    { label: 'Loan Directory', href: '/librarian/loans', icon: Library, primary: false },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">
            Welcome back, <span className="text-[#57A3CC]">{firstName}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage library operations and track book circulation.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshDashboard()}
          disabled={isValidating}
          className="gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <SetupAssistantPanel />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map(({ label, href, icon: Icon, primary }) => (
          <Link key={href} href={href}>
            <Button
              className={primary
                ? 'bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white border-0 gap-2'
                : 'gap-2 border-[#022172]/20 text-[#022172] dark:text-white hover:bg-[#022172]/5'}
              variant={primary ? 'default' : 'outline'}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map(({ label, value, sub, icon: Icon, color, border, valueClass }) => (
          <Card key={label} className={`border-t-4 ${border} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold mt-1 ${valueClass ?? 'text-[#022172] dark:text-white'}`}>
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                </div>
                <div className={`bg-gradient-to-br ${color} p-2.5 rounded-xl shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Loans */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#022172] dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#57A3CC]" />
                  Recent Loans
                </CardTitle>
                <CardDescription>Latest books issued to students</CardDescription>
              </div>
              <Link href="/librarian/loans">
                <Button variant="ghost" size="sm" className="gap-1 text-[#57A3CC] text-xs">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recent_loans && stats.recent_loans.length > 0 ? (
              <div className="space-y-2">
                {stats.recent_loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#57A3CC]/20 to-[#022172]/20 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-[#022172] dark:text-[#57A3CC]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{loan.book_title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(loan.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={loan.status === 'active'
                        ? 'border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950'
                        : 'border-green-400 text-green-600 bg-green-50 dark:bg-green-950'
                      }
                    >
                      {loan.status === 'active' ? 'Active' : 'Returned'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No recent loans to display.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Returns */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-[#022172] dark:text-white flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Overdue Returns
                </CardTitle>
                <CardDescription>Books past their due date</CardDescription>
              </div>
              {(stats?.overdue_loans ?? 0) > 0 && (
                <Link href="/librarian/loans">
                  <Button variant="ghost" size="sm" className="gap-1 text-red-500 text-xs">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {stats?.overdue_list && stats.overdue_list.length > 0 ? (
              <div className="space-y-2">
                {stats.overdue_list.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                        <BookX className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.book_title}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.student_name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-red-400 text-red-600 bg-red-50 dark:bg-red-950 shrink-0 gap-1">
                      <Clock className="h-3 w-3" />
                      {item.days_overdue}d
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500/60" />
                <p className="text-sm text-muted-foreground">No overdue books. Great job!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
