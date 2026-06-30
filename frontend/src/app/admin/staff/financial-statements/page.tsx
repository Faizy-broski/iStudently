'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from '@/lib/api/school-settings'
import { getSalaryRecords, getPayslipByPeriod, type SalaryRecord, type PayslipByPeriod } from '@/lib/api/salary'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Loader2, Printer, FileText, Search, RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { PayslipPreviewDialog, buildPayslipHtml } from '@/components/admin/PayslipDocument'
import { openPrintPreview, type PrintSchool } from '@/lib/utils/printLayout'

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/50',
  approved: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50',
  paid: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function staffFullName(record: SalaryRecord): string {
  const s = record.staff as any
  if (!s) return record.staff_id
  const p = s.profile || s.profiles || {}
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || s.employee_number || record.staff_id
}

function staffRole(record: SalaryRecord): string {
  const s = record.staff as any
  return s?.profile?.role || s?.profiles?.role || '-'
}

function staffDept(record: SalaryRecord): string {
  const s = record.staff as any
  return s?.department || '-'
}

function staffEmployeeNumber(record: SalaryRecord): string {
  const s = record.staff as any
  return s?.employee_number || '-'
}

// ---------------------------------------------------------------------------

export default function FinancialStatementsPage() {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const { isPluginActive } = useSchoolSettings()
  const t = useTranslations('financial_statements')

  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [page, setPage] = useState(1)
  const LIMIT = 20

  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Per-row payslip dialog state
  const [dialogPayslip, setDialogPayslip] = useState<PayslipByPeriod | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingPayslipId, setLoadingPayslipId] = useState<string | null>(null)

  // Bulk print state
  const [bulkPrinting, setBulkPrinting] = useState(false)

  const school: PrintSchool = {
    name: (campusCtx?.selectedCampus as any)?.name || 'School',
    logo_url: (campusCtx?.selectedCampus as any)?.logo_url,
    address: (campusCtx?.selectedCampus as any)?.address,
    phone: (campusCtx?.selectedCampus as any)?.phone,
  }

  const loadRecords = useCallback(async (p = 1) => {
    if (!schoolId) return
    setLoading(true)
    try {
      const res = await getSalaryRecords(schoolId, {
        month,
        year,
        page: p,
        limit: LIMIT,
        campus_id: campusId,
      })
      setRecords(res.data)
      setTotal(res.pagination.total)
      setTotalPages(res.pagination.totalPages)
      setPage(p)
      setHasLoaded(true)
    } catch (err: any) {
      toast.error(err.message || t('err_load'))
    } finally {
      setLoading(false)
    }
  }, [schoolId, campusId, month, year])

  async function handlePreviewPayslip(record: SalaryRecord) {
    setLoadingPayslipId(record.id)
    try {
      const staffId = record.staff_id
      const payslip = await getPayslipByPeriod(staffId, record.month, record.year, schoolId, campusId)
      setDialogPayslip(payslip)
      setDialogOpen(true)
    } catch (err: any) {
      toast.error(err.message || t('err_payslip'))
    } finally {
      setLoadingPayslipId(null)
    }
  }

  async function handleBulkPrint() {
    if (records.length === 0) return
    setBulkPrinting(true)

    try {
      let pdfSettings: PdfHeaderFooterSettings | null = null
      if (campusId) {
        const r = await getPdfHeaderFooter(campusId)
        if (r.success && r.data) pdfSettings = r.data
      }

      // Fetch all payslips
      const payslips: PayslipByPeriod[] = []
      for (const record of records) {
        try {
          const ps = await getPayslipByPeriod(record.staff_id, record.month, record.year, schoolId, campusId)
          payslips.push(ps)
        } catch {
          // skip records that fail to load
        }
      }

      if (payslips.length === 0) {
        toast.error(t('err_no_payslips'))
        return
      }

      // Combine all payslips with page breaks
      const combinedHtml = payslips
        .map((ps, i) => `<div style="page-break-after:${i < payslips.length - 1 ? 'always' : 'avoid'}">${buildPayslipHtml(ps, school)}</div>`)
        .join('\n')

      openPrintPreview({
        title: `Payslips — ${MONTH_NAMES[month]} ${year}`,
        bodyHtml: combinedHtml,
        bodyStyles: '',
        school,
        pdfSettings,
        pluginActive: isPluginActive('pdf_header_footer'),
      })
    } catch (err: any) {
      toast.error(err.message || t('err_bulk'))
    } finally {
      setBulkPrinting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7 text-[#1e3a5f] dark:text-blue-400" />
              {t('page_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('page_subtitle')}
              {campusCtx?.selectedCampus ? ` · ${campusCtx.selectedCampus.name}` : ''}
            </p>
          </div>
          {hasLoaded && records.length > 0 && (
            <Button onClick={handleBulkPrint} disabled={bulkPrinting} variant="outline">
              {bulkPrinting
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Printer className="h-4 w-4 mr-2" />}
              {t('print_all', { count: records.length })}
            </Button>
          )}
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">{t('label_month')}</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="h-8 w-36 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.slice(1).map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('label_year')}</Label>
                <Input
                  type="number"
                  className="h-8 w-24 text-sm"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                />
              </div>

              <Button
                onClick={() => loadRecords(1)}
                disabled={loading}
                className="h-8"
              >
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5 mr-1.5" />}
                {t('btn_load')}
              </Button>

              {hasLoaded && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => { setRecords([]); setHasLoaded(false); setTotal(0) }}
                >
                  <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t('btn_reset')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {hasLoaded && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {t('card_title', { month: MONTH_NAMES[month], year })}
                <Badge variant="secondary" className="ml-auto font-normal">
                  {total !== 1 ? t('records_count_plural', { count: total }) : t('records_count', { count: total })}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  {t('loading')}
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {t('no_records', { month: MONTH_NAMES[month], year })}
                  <br />
                  <span className="text-xs">
                    {t('no_records_hint')}
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('col_employee')}</TableHead>
                        <TableHead>{t('col_id')}</TableHead>
                        <TableHead>{t('col_role')}</TableHead>
                        <TableHead>{t('col_department')}</TableHead>
                        <TableHead>{t('col_status')}</TableHead>
                        <TableHead className="text-right">{t('col_base_salary')}</TableHead>
                        <TableHead className="text-right">{t('col_net_payable')}</TableHead>
                        <TableHead className="text-right">{t('col_actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => (
                        <TableRow key={record.id} className="group">
                          <TableCell>
                            <p className="font-medium text-sm">{staffFullName(record)}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {staffEmployeeNumber(record)}
                          </TableCell>
                          <TableCell className="text-sm capitalize">
                            {staffRole(record)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {staffDept(record)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${STATUS_COLORS[record.status] || ''}`}
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {fmt(record.base_salary)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm text-[#1e3a5f] dark:text-blue-400">
                            {fmt(record.net_salary)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handlePreviewPayslip(record)}
                              disabled={loadingPayslipId === record.id}
                            >
                              {loadingPayslipId === record.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Printer className="h-3 w-3 mr-1" />}
                              {t('btn_pay_stub')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    {t('pagination', { page, totalPages, total })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      disabled={page <= 1}
                      onClick={() => loadRecords(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      disabled={page >= totalPages}
                      onClick={() => loadRecords(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payslip Preview Dialog */}
      <PayslipPreviewDialog
        payslip={dialogPayslip}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogPayslip(null) }}
      />
    </div>
  )
}
