'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { AttendanceCode, AttendanceCodeType, AttendanceStateCode } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader, IconMinus, IconPlus, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'

interface CodeRow {
  id?: string
  title: string
  short_name: string
  sort_order: number
  type: AttendanceCodeType
  is_default: boolean
  state_code: AttendanceStateCode
  // track changes
  _dirty?: boolean
  _isNew?: boolean
  _deleted?: boolean
}

const TYPE_LABELS: Record<AttendanceCodeType, string> = {
  both: 'Teacher & Office',
  teacher: 'Teacher Only',
  official: 'Office Only'
}

const STATE_CODE_LABELS: Record<AttendanceStateCode, string> = {
  P: 'Present',
  A: 'Absent',
  H: 'Half Day'
}

export default function AttendanceCodesPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<CodeRow[]>([])

  // New row form
  const [newTitle, setNewTitle] = useState('')
  const [newShortName, setNewShortName] = useState('')
  const [newSortOrder, setNewSortOrder] = useState('')
  const [newType, setNewType] = useState<AttendanceCodeType>('both')
  const [newIsDefault, setNewIsDefault] = useState(false)
  const [newStateCode, setNewStateCode] = useState<AttendanceStateCode>('P')

  const loadCodes = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const result = await attendanceApi.getAttendanceCodes(schoolId, selectedCampus?.id, true)
      if (result.data) {
        setRows(result.data.map(c => ({
          id: c.id,
          title: c.title,
          short_name: c.short_name,
          sort_order: c.sort_order,
          type: c.type,
          is_default: c.is_default,
          state_code: c.state_code
        })))
      } else {
        toast.error(result.error || 'Failed to load attendance codes')
      }
    } catch {
      toast.error('Failed to load attendance codes')
    } finally {
      setLoading(false)
    }
  }, [schoolId, selectedCampus?.id])

  useEffect(() => {
    loadCodes()
  }, [loadCodes])

  // Update a field in an existing row
  const updateRow = (idx: number, field: keyof CodeRow, value: any) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, _dirty: true } : r))
  }

  // Mark row for deletion
  const markDelete = (idx: number) => {
    const row = rows[idx]
    if (!row.id) {
      // New unsaved row — just remove
      setRows(prev => prev.filter((_, i) => i !== idx))
    } else {
      const confirmed = window.confirm(`Delete attendance code "${row.title}"?`)
      if (confirmed) {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, _deleted: true } : r))
      }
    }
  }

  // Add new code row
  const addNewRow = () => {
    if (!newTitle.trim() || !newShortName.trim()) {
      toast.error('Title and Short Name are required')
      return
    }

    setRows(prev => [...prev, {
      title: newTitle.trim(),
      short_name: newShortName.trim(),
      sort_order: newSortOrder ? parseInt(newSortOrder) : 0,
      type: newType,
      is_default: newIsDefault,
      state_code: newStateCode,
      _isNew: true,
      _dirty: true
    }])

    // Reset new row form
    setNewTitle('')
    setNewShortName('')
    setNewSortOrder('')
    setNewType('both')
    setNewIsDefault(false)
    setNewStateCode('P')
  }

  // Save all changes
  const handleSave = useCallback(async () => {
    if (!schoolId) return

    setSaving(true)
    try {
      let errors = 0

      // 1. Delete marked rows
      for (const row of rows.filter(r => r._deleted && r.id)) {
        const result = await attendanceApi.deleteAttendanceCode(row.id!)
        if (!result.data) {
          toast.error(`Failed to delete "${row.title}": ${result.error}`)
          errors++
        }
      }

      // 2. Create new rows
      for (const row of rows.filter(r => r._isNew && !r._deleted)) {
        const result = await attendanceApi.createAttendanceCode({
          school_id: schoolId,
          campus_id: selectedCampus?.id || null,
          title: row.title,
          short_name: row.short_name,
          state_code: row.state_code,
          type: row.type,
          is_default: row.is_default,
          sort_order: row.sort_order
        })
        if (!result.data) {
          toast.error(`Failed to create "${row.title}": ${result.error}`)
          errors++
        }
      }

      // 3. Update dirty existing rows (not new, not deleted)
      for (const row of rows.filter(r => r._dirty && !r._isNew && !r._deleted && r.id)) {
        const result = await attendanceApi.updateAttendanceCode(row.id!, {
          title: row.title,
          short_name: row.short_name,
          sort_order: row.sort_order,
          type: row.type,
          is_default: row.is_default,
          state_code: row.state_code
        })
        if (!result.data) {
          toast.error(`Failed to update "${row.title}": ${result.error}`)
          errors++
        }
      }

      if (errors === 0) {
        toast.success('Attendance codes saved successfully')
      }

      // Reload to get fresh data
      await loadCodes()
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }, [schoolId, selectedCampus?.id, rows, loadCodes])

  const hasDirty = rows.some(r => r._dirty || r._deleted || r._isNew)
  const visibleRows = rows.filter(r => !r._deleted)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Codes</h1>
        <Button
          onClick={handleSave}
          disabled={saving || !hasDirty}
          className="gap-2"
        >
          {saving ? (
            <IconLoader className="h-4 w-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="h-4 w-4" />
          )}
          SAVE
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-center text-sm font-semibold uppercase tracking-wider">
            Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-8"></th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">Title</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">Short Name</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">Sort Order</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">Type</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">Default for Teacher</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-primary py-3 px-2">State Code</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Existing rows */}
                  {visibleRows.map((row, idx) => {
                    const actualIdx = rows.indexOf(row)
                    return (
                      <tr key={row.id || `new-${idx}`} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-1">
                          <button
                            onClick={() => markDelete(actualIdx)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <IconMinus className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={row.title}
                            onChange={(e) => updateRow(actualIdx, 'title', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={row.short_name}
                            onChange={(e) => updateRow(actualIdx, 'short_name', e.target.value)}
                            className="h-8 text-sm w-20"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={row.sort_order || ''}
                            onChange={(e) => updateRow(actualIdx, 'sort_order', parseInt(e.target.value) || 0)}
                            className="h-8 text-sm w-20"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={row.type}
                            onValueChange={(v) => updateRow(actualIdx, 'type', v as AttendanceCodeType)}
                          >
                            <SelectTrigger className="h-8 text-sm w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="both">Teacher & Office</SelectItem>
                              <SelectItem value="teacher">Teacher Only</SelectItem>
                              <SelectItem value="official">Office Only</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center">
                            <Checkbox
                              checked={row.is_default}
                              onCheckedChange={(c) => updateRow(actualIdx, 'is_default', !!c)}
                            />
                            <span className="ml-2 text-sm text-muted-foreground">
                              {row.is_default ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={row.state_code}
                            onValueChange={(v) => updateRow(actualIdx, 'state_code', v as AttendanceStateCode)}
                          >
                            <SelectTrigger className="h-8 text-sm w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="P">Present</SelectItem>
                              <SelectItem value="A">Absent</SelectItem>
                              <SelectItem value="H">Half Day</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}

                  {/* New row (add) */}
                  <tr className="border-b bg-muted/20">
                    <td className="py-2 px-1">
                      <button
                        onClick={addNewRow}
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Add"
                      >
                        <IconPlus className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Title"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={newShortName}
                        onChange={(e) => setNewShortName(e.target.value)}
                        placeholder="Code"
                        className="h-8 text-sm w-20"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="number"
                        value={newSortOrder}
                        onChange={(e) => setNewSortOrder(e.target.value)}
                        className="h-8 text-sm w-20"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select value={newType} onValueChange={(v) => setNewType(v as AttendanceCodeType)}>
                        <SelectTrigger className="h-8 text-sm w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Teacher & Office</SelectItem>
                          <SelectItem value="teacher">Teacher Only</SelectItem>
                          <SelectItem value="official">Office Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Checkbox
                        checked={newIsDefault}
                        onCheckedChange={(c) => setNewIsDefault(!!c)}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select value={newStateCode} onValueChange={(v) => setNewStateCode(v as AttendanceStateCode)}>
                        <SelectTrigger className="h-8 text-sm w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="P">Present</SelectItem>
                          <SelectItem value="A">Absent</SelectItem>
                          <SelectItem value="H">Half Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Save button */}
          {!loading && (
            <div className="flex justify-center pt-6">
              <Button
                onClick={handleSave}
                disabled={saving || !hasDirty}
                className="gap-2"
              >
                {saving ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconDeviceFloppy className="h-4 w-4" />
                )}
                SAVE
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
