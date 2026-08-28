'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, AlertTriangle, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchAuditLog, type FinaAuditLogRow } from '@/lib/api/fina-audit'

// Admin's own view of the audit log — single-school scoped by construction
// (audit-search.service.ts pins `admin` to their own school_id server-side),
// so unlike the supervisor's cross-municipality page, there's no school
// filter here.
export default function AdminFinaAuditPage() {
  const t = useTranslations('fina.supervisor')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [rows, setRows] = useState<FinaAuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runSearch = () => {
    setLoading(true)
    setError(null)
    searchAuditLog({
      action: action.trim() || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    }).then((res) => {
      if (res.error) setError(res.error)
      else setRows(res.data || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    runSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('audit_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('audit_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">{t('filter_action')}</label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder={t('filter_all_actions')} type="search" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">{t('filter_from')}</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">{t('filter_to')}</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={runSearch} className="gap-2">
              <Search className="h-4 w-4" />
              {t('filter_apply')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-6">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">{t('audit_empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('col_time')}</TableHead>
                  <TableHead>{t('col_action')}</TableHead>
                  <TableHead>{t('col_actor')}</TableHead>
                  <TableHead>{t('col_subject')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-gray-500 text-xs">{new Date(row.occurred_at).toLocaleString()}</TableCell>
                    <TableCell className="font-medium text-gray-900">{row.action}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{row.actor_role || '—'}</TableCell>
                    <TableCell className="text-gray-500 text-xs">{row.subject_type ? `${row.subject_type}` : '—'}</TableCell>
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
