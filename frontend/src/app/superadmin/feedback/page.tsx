'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquareWarning, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getFeedbackReports, updateFeedbackStatus, type FeedbackReport } from '@/lib/api/feedback'

const STATUS_COLORS: Record<FeedbackReport['status'], string> = {
  open:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  resolved:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

const CATEGORY_COLORS: Record<FeedbackReport['category'], string> = {
  feature_request: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  bug:              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

export default function SuperAdminFeedbackPage() {
  const t = useTranslations('superadmin.feedback')
  const STATUS_LABELS: Record<FeedbackReport['status'], string> = {
    open: t('status_open'),
    in_progress: t('status_in_progress'),
    resolved: t('status_resolved'),
  }
  const CATEGORY_LABELS: Record<FeedbackReport['category'], string> = {
    feature_request: t('feature_request'),
    bug: t('bug'),
  }
  const [reports, setReports] = useState<FeedbackReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFeedbackReports(
        statusFilter !== 'all' ? statusFilter : undefined,
        categoryFilter !== 'all' ? categoryFilter : undefined
      )
      if (res.success) setReports(res.data || [])
      else toast.error(res.error || t('load_failed'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  const handleStatusChange = async (id: string, status: FeedbackReport['status']) => {
    setUpdatingId(id)
    try {
      const res = await updateFeedbackStatus(id, status)
      if (!res.success) { toast.error(res.error || t('update_failed')); return }
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      toast.success(t('status_updated'))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-[#022172] dark:text-white">
            <MessageSquareWarning className="h-7 w-7" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('filter_by_category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_categories')}</SelectItem>
              <SelectItem value="feature_request">{t('feature_request')}</SelectItem>
              <SelectItem value="bug">{t('bug')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('filter_by_status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_statuses')}</SelectItem>
              <SelectItem value="open">{t('status_open')}</SelectItem>
              <SelectItem value="in_progress">{t('status_in_progress')}</SelectItem>
              <SelectItem value="resolved">{t('status_resolved')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {statusFilter !== 'all'
                ? t('no_reports_with_status', { status: STATUS_LABELS[statusFilter as FeedbackReport['status']] })
                : t('no_reports_yet')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('column_category')}</TableHead>
                  <TableHead>{t('column_title')}</TableHead>
                  <TableHead>{t('column_description')}</TableHead>
                  <TableHead>{t('column_submitted_by')}</TableHead>
                  <TableHead>{t('column_date')}</TableHead>
                  <TableHead>{t('column_status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline" className={CATEGORY_COLORS[r.category]}>
                        {CATEGORY_LABELS[r.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{r.title}</TableCell>
                    <TableCell className="max-w-[320px] text-sm text-muted-foreground truncate" title={r.description}>
                      {r.description}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{r.submitter_name || t('unknown_submitter')}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.submitter_role || '—'}{r.submitter_email ? ` · ${r.submitter_email}` : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.status}
                        onValueChange={(v) => handleStatusChange(r.id, v as FeedbackReport['status'])}
                        disabled={updatingId === r.id}
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue>
                            <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                              {STATUS_LABELS[r.status]}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">{t('status_open')}</SelectItem>
                          <SelectItem value="in_progress">{t('status_in_progress')}</SelectItem>
                          <SelectItem value="resolved">{t('status_resolved')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
