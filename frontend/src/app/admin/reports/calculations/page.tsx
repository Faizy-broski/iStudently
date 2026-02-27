'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
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
import { Calculator, Play, Save, Trash2, Edit2, Plus, Delete, Loader2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useGradeLevels } from '@/hooks/useAcademics'
import {
  type Calculation,
  type RunResult,
  type RunFilters,
  getCalculations,
  createCalculation,
  updateCalculation,
  deleteCalculation,
  runCalculation,
  runFormula,
} from '@/lib/api/calculations'

// ---- Constants ----

const FUNCTIONS = ['sum', 'average', 'count', 'max', 'min', 'average-max', 'average-min', 'sum-max', 'sum-min']
const OPERATORS = ['+', '-', '*', '/', '(', ')']
const TIME_VALUE_FIELDS = [
  { label: 'Present', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Enrolled', value: 'enrolled' },
]
const ROSARIO_FIELDS = [
  { label: 'Student ID', value: 'student_id' },
]
const CONSTANTS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0']
const BREAKDOWN_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Grade Level', value: 'grade_level' },
  { label: 'Section', value: 'section' },
  { label: 'Student', value: 'student' },
]

// ---- Component ----

export default function CalculationsPage() {
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  // ---- Formula builder state ----
  const [formula, setFormula] = useState('')
  const [pendingFn, setPendingFn] = useState<string | null>(null) // waiting for a field to be inserted into
  const [title, setTitle] = useState('')
  const [breakdown, setBreakdown] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  // ---- Filters ----
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [sectionId, setSectionId] = useState('') // future use if needed

  // ---- Run state ----
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [runForId, setRunForId] = useState<string | null>(null)

  // ---- Filter popover ----
  const [filterOpen, setFilterOpen] = useState(false)

  // open filters automatically when user starts building a formula
  // track previous formula length so we only open filters when typing more, not deleting
  const prevFormulaRef = useRef<string>('')
  useEffect(() => {
    const prev = prevFormulaRef.current
    if (
      formula.trim() &&
      !filterOpen &&
      !runResult &&
      formula.length > prev.length
    ) {
      setFilterOpen(true)
    }
    prevFormulaRef.current = formula
  }, [formula, filterOpen, runResult])

  // close filters whenever we have a result so it doesn't reopen
  useEffect(() => {
    if (runResult) setFilterOpen(false)
  }, [runResult])

  // ---- Save state ----
  const [saving, setSaving] = useState(false)

  // ---- Delete dialog ----
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; calc: Calculation | null }>({
    open: false,
    calc: null,
  })
  const [deleting, setDeleting] = useState(false)

  const cacheKey = ['calculations', selectedCampus?.id]

  // academics data for filters
  const { gradeLevels, loading: gradesLoading } = useGradeLevels()

  const { data: calculations, isLoading } = useSWR(
    cacheKey,
    () => getCalculations(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  // ---- Formula token helpers ----

  const appendToFormula = (token: string) => {
    setFormula((prev) => (prev ? `${prev} ${token}` : token))
    setRunResult(null)
    // user explicitly added something, open filters
    setFilterOpen(true)
  }

  const handleFunctionClick = (fn: string) => {
    setPendingFn(fn)
  }

  const handleFieldClick = (field: string) => {
    // prevent inserting a field/constant if the formula is empty or the
    // last token is not an operator/parenthesis. This stops the very first
    // token being a field as well as consecutive fields without an operator
    // between (e.g. `enrolled enrolled`). Functions are handled separately
    // when `pendingFn` is set.
    if (!pendingFn) {
      const trimmed = formula.trim()
      const lastChar = trimmed.slice(-1)
      if (
        trimmed === '' ||
        !/[\+\-\*\/\(]/.test(lastChar)
      ) {
        toast.error('A field cannot be placed here; choose an operator instead.')
        return
      }
    }

    if (pendingFn) {
      appendToFormula(`${pendingFn}( ${field} )`)
      setPendingFn(null)
    } else {
      appendToFormula(field)
    }
  }

  const handleBackspace = () => {
    setFormula((prev) => {
      const trimmed = prev.trimEnd()
      const lastSpace = trimmed.lastIndexOf(' ')
      return lastSpace === -1 ? '' : trimmed.slice(0, lastSpace)
    })
    setRunResult(null)
  }

  const handleClear = () => {
    setFormula('')
    setPendingFn(null)
    setRunResult(null)
  }

  // ---- Save / Edit ----

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Please enter a title'); return }
    if (!formula.trim()) { toast.error('Please build a formula'); return }
    setSaving(true)
    try {
      if (editingId) {
        await updateCalculation(editingId, { title, formula, breakdown: breakdown || undefined })
        toast.success('Calculation updated')
      } else {
        await createCalculation({
          title,
          formula,
          breakdown: breakdown || undefined,
          campus_id: selectedCampus?.id,
        })
        toast.success('Calculation saved')
      }
      await mutate(cacheKey)
      resetForm()
    } catch {
      toast.error('Failed to save calculation')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (calc: Calculation) => {
    setEditingId(calc.id)
    setTitle(calc.title)
    setFormula(calc.formula)
    setBreakdown(calc.breakdown || '')
    setRunResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setFormula('')
    setBreakdown('')
    setRunResult(null)
    setPendingFn(null)
  }

  // ---- Run ----

  const handleRun = useCallback(async (calcId?: string) => {
    const id = calcId || editingId
    if (!id && !formula.trim()) { toast.error('No formula to run'); return }

    setRunning(true)
    setRunForId(calcId || null)
    setRunResult(null)

    // close the filter popover when starting run
    setFilterOpen(false)


    try {
      const filters: RunFilters = {
        campus_id: selectedCampus?.id,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        grade_level_id: gradeLevelId || undefined,
        section_id: sectionId || undefined,
      }

      let result: RunResult | null = null
      if (id) {
        result = await runCalculation(id, filters)
      } else {
        // run the unsaved formula directly
        result = await runFormula(formula, filters, breakdown || undefined)
      }
      setRunResult(result)

      // after execution, if not editing an existing calc, offer save
      if (!id) {
        toast.custom((t) => (
          <div className="bg-white rounded-md shadow p-3 max-w-xs">
            <p className="text-sm">Calculation ran successfully.</p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                toast.dismiss(t.id)
                handleSave()
              }}
            >
              Save formula
            </Button>
          </div>
        ))
      }
    } catch {
      toast.error('Failed to run calculation')
    } finally {
      setRunning(false)
      setRunForId(null)
    }
  }, [editingId, formula, selectedCampus?.id, startDate, endDate, gradeLevelId, breakdown, sectionId])

  // ---- Delete ----

  const handleDelete = async () => {
    if (!deleteDialog.calc) return
    setDeleting(true)
    try {
      await deleteCalculation(deleteDialog.calc.id)
      await mutate(cacheKey)
      if (editingId === deleteDialog.calc.id) resetForm()
      toast.success('Calculation deleted')
      setDeleteDialog({ open: false, calc: null })
    } catch {
      toast.error('Failed to delete calculation')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Render ----

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Calculations</h1>
            <p className="text-sm text-muted-foreground">
              Build and save formulas using attendance and grade data.
              {selectedCampus && <span className="ml-2 text-primary font-medium">— {selectedCampus.name}</span>}
            </p>
          </div>
        </div>
        {pendingFn && (
          <Badge variant="secondary" className="animate-pulse">
            Select a field for <strong className="ml-1">{pendingFn}(…)</strong>
            <button onClick={() => setPendingFn(null)} className="ml-2"><X className="h-3 w-3" /></button>
          </Badge>
        )}
      </div>

      {/* Builder panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Functions & Operators */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Functions &amp; Operators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Functions</p>
                <div className="flex flex-wrap gap-1">
                  {FUNCTIONS.map((fn) => (
                    <Button
                      key={fn}
                      variant={pendingFn === fn ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleFunctionClick(fn)}
                    >
                      {fn}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Operators</p>
                <div className="flex flex-wrap gap-1">
                  {OPERATORS.map((op) => (
                    <Button
                      key={op}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 w-10 font-mono"
                      onClick={() => appendToFormula(op)}
                    >
                      {op}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Time Values</p>
                <div className="flex flex-col gap-1">
                  {TIME_VALUE_FIELDS.map((f) => (
                    <Button
                      key={f.value}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-8 justify-start ${pendingFn ? 'border-primary text-primary' : ''}`}
                      onClick={() => handleFieldClick(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Istudently Fields</p>
                <div className="flex flex-col gap-1">
                  {ROSARIO_FIELDS.map((f) => (
                    <Button
                      key={f.value}
                      variant="outline"
                      size="sm"
                      className={`text-xs h-8 justify-start ${pendingFn ? 'border-primary text-primary' : ''}`}
                      onClick={() => handleFieldClick(f.value)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Constants</p>
                <div className="grid grid-cols-3 gap-1">
                  {CONSTANTS.map((c) => (
                    <Button
                      key={c}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 font-mono"
                      onClick={() => appendToFormula(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equation box */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Equation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Calculation title..."
              className="max-w-xs h-9"
            />
            <Select value={breakdown} onValueChange={setBreakdown}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Breakdown" />
              </SelectTrigger>
              <SelectContent>
                {BREAKDOWN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value || 'none'}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingId && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancel Edit
              </Button>
            )}
          </div>

          {/* Formula display */}
          <div className="bg-muted rounded-md px-4 py-3 font-mono text-sm min-h-[2.5rem] border">
            {formula || <span className="text-muted-foreground">Formula will appear here...</span>}
          </div>

          {/* Formula actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBackspace}>
              <Delete className="h-4 w-4 mr-1" /> Backspace
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-80">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Date from:</span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">to:</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 w-36 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Grade level:</span>
                    <Select
                      value={gradeLevelId}
                      onValueChange={(val) => setGradeLevelId(val === 'none' ? '' : val)}
                      className="w-48 h-8 text-sm"
                      disabled={gradesLoading}
                    >
                      <SelectTrigger className="w-full h-8">
                        <SelectValue placeholder="All grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">All grades</SelectItem>
                        {gradeLevels.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRun()}
              disabled={running || (!editingId && !formula.trim())}
              className="text-primary"
            >
              {running ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Run
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !title.trim() || !formula.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Results */}
      {runResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runResult.type === 'single' ? (
              <div className="text-4xl font-bold text-primary text-center py-4">
                {typeof runResult.value === 'number'
                  ? runResult.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                  : runResult.value}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runResult.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right font-mono">
                        {typeof row.value === 'number'
                          ? row.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                          : row.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved calculations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Saved Calculations
            {selectedCampus && <span className="ml-2 text-sm font-normal text-muted-foreground">— {selectedCampus.name}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !calculations || calculations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No calculations saved yet.</p>
              <p className="text-sm">Build a formula above and click Save.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.map((calc) => (
                  <TableRow key={calc.id} className={editingId === calc.id ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">{calc.title}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 rounded">{calc.formula}</code>
                    </TableCell>
                    <TableCell>
                      {calc.breakdown ? (
                        <Badge variant="outline" className="text-xs">{calc.breakdown}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(calc)}
                          className="h-7 px-2"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={running && runForId === calc.id}
                          onClick={() => handleRun(calc.id)}
                          className="h-7 px-2 text-primary"
                        >
                          {running && runForId === calc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, calc })}
                          className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, calc: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Calculation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.calc?.title}&quot;? Any reports using this calculation will be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, calc: null })}>Cancel</Button>
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
