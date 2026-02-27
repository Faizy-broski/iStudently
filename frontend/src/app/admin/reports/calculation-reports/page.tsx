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

const BREAKDOWN_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Grade Level', value: 'grade_level' },
  { label: 'Section', value: 'section' },
  { label: 'Student', value: 'student' },
]

// ---- Helper: empty grid cell ----
const emptyCell = (): ReportCell => ({})

// ---- Result cell renderer ----
function ResultCellView({ result, showGraph }: { result: RunResult | null; showGraph?: boolean }) {
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
    if (!reportTitle.trim()) { toast.error('Please enter a report title'); return }
    setSaving(true)
    try {
      if (editingReport) {
        await updateCalculationReport(editingReport.id, { title: reportTitle, cells: grid })
        toast.success('Report updated')
      } else {
        await createCalculationReport({
          title: reportTitle,
          cells: grid,
          campus_id: selectedCampus?.id,
        })
        toast.success('Report saved')
      }
      await mutate(reportsCacheKey)
      setMode('list')
    } catch {
      toast.error('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  // ---- Run report ----

  const handleRun = async (reportId?: string) => {
    const id = reportId || editingReport?.id
    if (!id) { toast.error('Save the report first to run it'); return }

    setRunning(true)
    try {
      const filters: RunFilters = {
        campus_id: selectedCampus?.id,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }
      const response = await runCalculationReport(id, filters)
      if (!response) throw new Error('No response')
      setRunResponse(response)
      setGrid(response.cells)
      setMode('results')
    } catch {
      toast.error('Failed to run report')
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
      toast.success('Report deleted')
      setDeleteDialog({ open: false, report: null })
    } catch {
      toast.error('Failed to delete report')
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
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Builder
          </Button>
          <h1 className="text-2xl font-bold">{reportTitle} — Results</h1>
          {selectedCampus && (
            <Badge variant="secondary">{selectedCampus.name}</Badge>
          )}
        </div>

        {/* Filters for re-run */}
        <div className="flex items-center gap-4 flex-wrap">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" placeholder="Start date" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-sm" placeholder="End date" />
          <Button size="sm" onClick={() => handleRun(editingReport?.id)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Re-run
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
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold">
            {editingReport ? 'Edit Report' : 'New Calculation Report'}
          </h1>
          {selectedCampus && (
            <Badge variant="secondary">{selectedCampus.name}</Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleRun(editingReport?.id)}
              disabled={running || !editingReport}
              title={!editingReport ? 'Save report first' : 'Run report'}
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              GO
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3">
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Report title..."
            className="max-w-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="text-muted-foreground">Date range:</span>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" />
          <span className="text-muted-foreground">to</span>
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
                            placeholder="Label (optional)"
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
                              <SelectValue placeholder="Calculation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
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
                              <SelectValue placeholder="Breakdown" />
                            </SelectTrigger>
                            <SelectContent>
                              {BREAKDOWN_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
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
                            Graph Results
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
                <Plus className="h-4 w-4 mr-1" /> ADD COLUMN
              </Button>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> ADD ROW
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
            <h1 className="text-2xl font-bold">Calculation Reports</h1>
            <p className="text-sm text-muted-foreground">
              Compose reports from saved calculations.
              {selectedCampus && (
                <span className="ml-2 text-primary font-medium">— {selectedCampus.name}</span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
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
              <p>No reports yet.</p>
              <p className="text-sm mt-1">Create your first Calculation Report.</p>
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> New Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Cells</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
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
                          {report.cells.length} row{report.cells.length !== 1 ? 's' : ''},{' '}
                          {report.cells[0]?.length || 0} col{(report.cells[0]?.length || 0) !== 1 ? 's' : ''},{' '}
                          {cellCount} calc{cellCount !== 1 ? 's' : ''}
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
                              } catch { toast.error('Failed to run report') }
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
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.report?.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, report: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
