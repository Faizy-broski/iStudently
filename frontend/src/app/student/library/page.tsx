'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getAuthToken } from '@/lib/api/schools'
import { getActiveLoans, getOverdueLoans, getStudentLoanHistory, getUnpaidFines } from '@/lib/api/library'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, BookOpen, AlertCircle, Clock, CheckCircle, Library } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'

type Tab = 'active' | 'overdue' | 'history' | 'fines'

function LoanCard({ loan, showStatus = false }: { loan: any; showStatus?: boolean }) {
  const dueDate = loan.due_date ? parseISO(loan.due_date) : null
  const isOverdue = dueDate && dueDate < new Date() && !loan.returned_at
  const daysLeft = dueDate && !loan.returned_at ? differenceInDays(dueDate, new Date()) : null

  const book = loan.book_copy?.book || loan.book || {}
  const title = book.title || 'Unknown Book'
  const author = book.author || ''

  return (
    <Card className={isOverdue ? 'border-red-200' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{title}</p>
            {author && <p className="text-xs text-muted-foreground">{author}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              {loan.issued_at && (
                <span className="text-xs text-muted-foreground">
                  Issued: {format(parseISO(loan.issued_at), 'MMM d, yyyy')}
                </span>
              )}
              {dueDate && (
                <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  Due: {format(dueDate, 'MMM d, yyyy')}
                  {daysLeft !== null && !loan.returned_at && (
                    <span className="ml-1">
                      {isOverdue ? `(${Math.abs(daysLeft)}d overdue)` : `(${daysLeft}d left)`}
                    </span>
                  )}
                </span>
              )}
              {loan.returned_at && (
                <span className="text-xs text-green-600">
                  Returned: {format(parseISO(loan.returned_at), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
          {showStatus && (
            <Badge
              variant="outline"
              className={`text-xs shrink-0 ${
                loan.returned_at ? 'border-green-400 text-green-600'
                : isOverdue ? 'border-red-400 text-red-600'
                : 'border-blue-400 text-blue-600'
              }`}
            >
              {loan.returned_at ? 'Returned' : isOverdue ? 'Overdue' : 'Active'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StudentLibraryPage() {
  const { profile } = useAuth()
  const studentId = profile?.student_id
  const [tab, setTab] = useState<Tab>('active')

  const fetchWithToken = async (fn: (id: string, tok: string) => Promise<any>) => {
    const token = await getAuthToken()
    if (!token || !studentId) throw new Error('Not authenticated')
    const res = await fn(studentId, token)
    if (!res.success) throw new Error(res.error || 'Failed to fetch')
    return res.data || []
  }

  const { data: activeLoans, isLoading: loadingActive } = useSWR(
    studentId ? ['library-active', studentId] : null,
    () => fetchWithToken(getActiveLoans),
    { revalidateOnFocus: false }
  )

  const { data: overdueLoans, isLoading: loadingOverdue } = useSWR(
    studentId ? ['library-overdue', studentId] : null,
    () => fetchWithToken(getOverdueLoans),
    { revalidateOnFocus: false }
  )

  const { data: loanHistory, isLoading: loadingHistory } = useSWR(
    studentId && tab === 'history' ? ['library-history', studentId] : null,
    () => fetchWithToken(getStudentLoanHistory),
    { revalidateOnFocus: false }
  )

  const { data: fines, isLoading: loadingFines } = useSWR(
    studentId && tab === 'fines' ? ['library-fines', studentId] : null,
    () => fetchWithToken(getUnpaidFines),
    { revalidateOnFocus: false }
  )

  const overdueCount = (overdueLoans || []).length

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'active', label: 'Active Loans', count: (activeLoans || []).length },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
    { key: 'history', label: 'History' },
    { key: 'fines', label: 'Fines' },
  ]

  const isLoading =
    (tab === 'active' && loadingActive) ||
    (tab === 'overdue' && loadingOverdue) ||
    (tab === 'history' && loadingHistory) ||
    (tab === 'fines' && loadingFines)

  const currentData: any[] =
    tab === 'active' ? (activeLoans || []) :
    tab === 'overdue' ? (overdueLoans || []) :
    tab === 'history' ? (loanHistory || []) :
    (fines || [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Library</h1>
        <p className="text-muted-foreground mt-1">Manage your book loans and fines</p>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">{(activeLoans || []).length} Active</span>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">{overdueCount} Overdue</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                t.key === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {!studentId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Student profile not found</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tab === 'fines' ? (
        currentData.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="font-medium">No outstanding fines</p>
              <p className="text-sm text-muted-foreground mt-1">You have no unpaid library fines</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {currentData.map((fine: any) => (
              <Card key={fine.id} className="border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{fine.reason || 'Library Fine'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {fine.created_at ? format(parseISO(fine.created_at), 'MMM d, yyyy') : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-400 text-sm font-bold">
                      ${(fine.amount || 0).toFixed(2)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : currentData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              {tab === 'active' ? 'No active loans'
               : tab === 'overdue' ? 'No overdue books'
               : 'No loan history'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentData.map((loan: any) => (
            <LoanCard key={loan.id} loan={loan} showStatus={tab === 'history'} />
          ))}
        </div>
      )}
    </div>
  )
}
