'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Play,
  Save,
  ChevronLeft,
  Edit2,
  X,
  BarChart2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  type Calculation,
  type CalculationReport,
  type ReportCell,
  type RunResult,
  type ReportRunResponse,
  type RunFilters,
  getCalculations,
  getCalculationReports,
  createCalculationReport,
  updateCalculationReport,
  deleteCalculationReport,
  runCalculationReport,
} from '@/lib/api/calculations'
import { useTranslations } from 'next-intl'

const BREAKDOWN_OPTIONS = [
  { value: 'none' },
  { value: 'grade_level' },
  { value: 'section' },
  { value: 'student' },
]

// ---- Helper: empty grid cell ----
const emptyCell = (): ReportCell => ({})

// ---- Result cell renderer ----
function ResultCellView({ result, showGraph }: { result: RunResult | null; showGraph?: boolean }) {
  const t = useTranslations('admin.reports.calculation_reports')
  if (!result) return <span className="text-muted-foreground text-xs">—</span>

  if (result.type === 'single') {
    return (
      <span className="text-lg font-bold text-primary">
        {typeof result.value === 'number'
          ? result.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
          : result.value}
      </span>
    )
  }

  const maxVal = Math.max(...result.rows.map((r) => (typeof r.value === 'number' ? r.value : 0)))

  return (
    <div className="space-y-1 w-full min-w-[140px]">
      {result.rows.map((row, i) => (
        <div key={i} className="text-xs">
          <div className="flex justify-between mb-0.5">
            <span className="text-muted-foreground truncate max-w-[8rem]">{row.label}</span>
            <span className="font-mono font-medium ml-2">
              {typeof row.value === 'number'
                ? row.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : row.value}
            </span>
          </div>
          {showGraph && typeof row.value === 'number' && maxVal > 0 && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round((row.value / maxVal) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Main component ----

export default function CalculationReportsPage() {
  const t = useTranslations('admin.reports.calculation_reports')
  const tCommon = useTranslations('common')
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  // ---- List view state ----
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    report: CalculationReport | null
  }>({ open: false, report: null })
  const [deleting, setDeleting] = useState(false)

  // ---- Builder / editor state ----
  const [mode, setMode] = useState<'list' | 'edit' | 'results'>('list')
  const [editingReport, setEditingReport] = useState<CalculationReport | null>(null)
  const [reportTitle, setReportTitle] = useState('')
  const [grid, setGrid] = useState<ReportCell[][]>([[emptyCell()]])
  const [saving, setSaving] = useState(false)

  // ---- Run state ----
  const [running, setRunning] = useState(false)
  const [runResponse, setRunResponse] = useState<ReportRunResponse | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const reportsCacheKey = ['calculation-reports', selectedCampus?.id]
  const calcsCacheKey = ['calculations', selectedCampus?.id]

  const { data: reports, isLoading: loadingReports } = useSWR(
    reportsCacheKey,
    () => getCalculationReports(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  const { data: calculations } = useSWR(
    calcsCacheKey,
    () => getCalculations(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  const calcMap: Record<string, Calculation> = {}
  if (calculations) {
    for (const c of calculations) calcMap[c.id] = c
  }

  // ---- Grid helpers ----

  const addRow = () => setGrid((prev) => [...prev, prev[0].map(() => emptyCell())])

  const addColumn = () =>
    setGrid((prev) => prev.map((row) => [...row, emptyCell()]))

  const removeRow = (rowIdx: number) =>
    setGrid((prev) => prev.filter((_, i) => i !== rowIdx))

  const removeColumn = (colIdx: number) =>
    setGrid((prev) => prev.map((row) => row.filter((_, i) => i !== colIdx)))

  const updateCell = (rowIdx: number, colIdx: number, patch: Partial<ReportCell>) =>
    setGrid((prev) =>
      prev.map((row, ri) =>
        ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? { ...cell, ...patch } : cell)) : row
      )
    )

  // ---- Open editor ----

  const openNew = () => {
    setEditingReport(null)
    setReportTitle('')
    setGrid([[emptyCell()]])
    setRunResponse(null)
    setMode('edit')
  }

  const openEdit = (report: CalculationReport) => {
    setEditingReport(report)
    setReportTitle(report.title)
    setGrid(report.cells.length > 0 ? report.cells : [[emptyCell()]])
    setRunResponse(null)
    setMode('edit')
  }

  // ---- Save report ----

  const handleSave = async () => {
    if (!reportTitle.trim()) { toast.error(t('toast.enter_title')); return }
    setSaving(true)
    try {
      if (editingReport) {
        await updateCalculationReport(editingReport.id, { title: reportTitle, cells: grid })
        toast.success(t('toast.updated'))
      } else {
        await createCalculationReport({
          title: reportTitle,
          cells: grid,
          campus_id: selectedCampus?.id,
        })
        toast.success(t('toast.saved'))
      }
      await mutate(reportsCacheKey)
      setMode('list')
    } catch {
      toast.error(t('toast.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  // ---- Run report ----

  const handleRun = async (reportId?: string) => {
    const id = reportId || editingReport?.id
    if (!id) { toast.error(t('toast.save_first')); return }

    setRunning(true)
    try {
      const filters: RunFilters = {
        campus_id: selectedCampus?.id,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }
      const response = await runCalculationReport(id, filters)
      if (!response) throw new Error(t('toast.no_response'))
      setRunResponse(response)
      setGrid(response.cells)
      setMode('results')
    } catch {
      toast.error(t('toast.run_failed'))
    } finally {
      setRunning(false)
    }
  }

  // ---- Delete ----

  const handleDelete = async () => {
    if (!deleteDialog.report) return
    setDeleting(true)
    try {
      await deleteCalculationReport(deleteDialog.report.id)
      await mutate(reportsCacheKey)
      toast.success(t('toast.deleted'))
      setDeleteDialog({ open: false, report: null })
    } catch {
      toast.error(t('toast.delete_failed'))
    } finally {
      setDeleting(false)
    }
  }

  // ---- Results view ----

  if (mode === 'results' && runResponse) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {t('back_to_builder')}
          </Button>
          <h1 className="text-2xl font-bold">{reportTitle} — {t('results')}</h1>
          {selectedCampus && (
            <Badge variant="secondary">{selectedCampus.name}</Badge>
          )}
        </div>

        {/* Filters for re-run */}
        <div className="flex items-center gap-4 flex-wrap">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" placeholder={t('start_date')} />
          <span className="text-muted-foreground text-sm">{tCommon('to')}</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-sm" placeholder={t('end_date')} />
          <Button size="sm" onClick={() => handleRun(editingReport?.id)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {t('rerun')}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {runResponse.results.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((result, ci) => {
                      const cell = runResponse.cells[ri]?.[ci] || {}
                      return (
                        <td
                          key={ci}
                          className="border p-3 align-top min-w-[120px]"
                        >
                          {cell.text && (
                            <div className="text-sm font-semibold mb-1">{cell.text}</div>
                          )}
                          {result ? (
                            <ResultCellView result={result} showGraph={cell.show_graph} />
                          ) : cell.text ? null : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Builder / editor view ----

  if (mode === 'edit') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setMode('list')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon('back')}
          </Button>
          <h1 className="text-xl font-bold">
            {editingReport ? t('edit_report') : t('new_report')}
          </h1>
          {selectedCampus && (
            <Badge variant="secondary">{selectedCampus.name}</Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleRun(editingReport?.id)}
              disabled={running || !editingReport}
              title={!editingReport ? t('save_first_title') : t('run_report')}
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {t('go')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {tCommon('save')}
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3">
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder={t('title_placeholder')}
            className="max-w-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="text-muted-foreground">{t('date_range')}</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" />
          <span className="text-muted-foreground">{tCommon('to')}</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-sm" />
        </div>

        {/* Grid builder */}
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-8" />
                  {grid[0]?.map((_, ci) => (
                    <th key={ci} className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => removeColumn(ci)}
                        disabled={grid[0].length <= 1}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pr-1 align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(ri)}
                        disabled={grid.length <= 1}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border p-2 align-top min-w-[200px]">
                        <div className="space-y-2">
                          {/* Text label */}
                          <Input
                            value={cell.text || ''}
                            onChange={(e) => updateCell(ri, ci, { text: e.target.value })}
                            placeholder={t('label_optional')}
                            className="h-7 text-xs"
                          />
                          {/* Calculation select */}
                          <Select
                            value={cell.calculation_id || 'none'}
                            onValueChange={(v) =>
                              updateCell(ri, ci, { calculation_id: v === 'none' ? undefined : v })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder={t('calculation')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— {t('none')} —</SelectItem>
                              {(calculations || []).map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Breakdown */}
                          <Select
                            value={cell.breakdown || 'none'}
                            onValueChange={(v) =>
                              updateCell(ri, ci, { breakdown: v === 'none' ? undefined : v })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder={t('breakdown')} />
                            </SelectTrigger>
                            <SelectContent>
                              {BREAKDOWN_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.value === 'none' ? t('none') : t(`breakdown_options.${o.value}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Graph toggle */}
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!cell.show_graph}
                              onChange={(e) => updateCell(ri, ci, { show_graph: e.target.checked })}
                              className="rounded"
                            />
                            <BarChart2 className="h-3 w-3" />
                            {t('graph_results')}
                          </label>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-1" /> {t('add_column')}
              </Button>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> {t('add_row')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- List view ----

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('subtitle')}
              {selectedCampus && (
                <span className="ml-2 text-primary font-medium">— {selectedCampus.name}</span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t('new_report')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingReports ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('no_reports')}</p>
              <p className="text-sm mt-1">{t('no_reports_desc')}</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> {t('new_report')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon('title')}</TableHead>
                  <TableHead>{t('cells')}</TableHead>
                  <TableHead>{t('created')}</TableHead>
                  <TableHead className="w-32 text-right">{tCommon('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const cellCount = report.cells.reduce((s, row) => s + row.filter((c) => c.calculation_id).length, 0)
                  return (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {t('cells_summary', {
                            rows: report.cells.length,
                            cols: report.cells[0]?.length || 0,
                            calcs: cellCount,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(report)}
                            className="h-8 px-2"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={running}
                            onClick={async () => {
                              openEdit(report)
                              // Run immediately after opening
                              setRunning(true)
                              try {
                                const filters: RunFilters = { campus_id: selectedCampus?.id }
                                const response = await runCalculationReport(report.id, filters)
                                if (response) { setRunResponse(response); setGrid(response.cells); setMode('results') }
                              } catch { toast.error(t('toast.run_failed')) }
                              finally { setRunning(false) }
                            }}
                            className="h-8 px-2 text-primary"
                          >
                            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, report })}
                            className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, report: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_desc', { title: deleteDialog.report?.title || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, report: null })}>{tCommon('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
