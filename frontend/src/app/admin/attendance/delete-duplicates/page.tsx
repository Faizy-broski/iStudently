'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { DuplicateAttendanceRecord } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'

export default function DeleteDuplicateAttendancePage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateAttendanceRecord[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // Load duplicates on mount
  const loadDuplicates = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const result = await attendanceApi.findDuplicateAttendance(schoolId, undefined, undefined, selectedCampus?.id)
      if (result.data) {
        setDuplicates(result.data)
        setSelectedIndices(new Set())
      } else {
        toast.error(result.error || 'Failed to load duplicates')
      }
    } catch {
      toast.error('Failed to load duplicates')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    loadDuplicates()
  }, [loadDuplicates])

  // Select all / deselect all
  const allSelected = duplicates.length > 0 && selectedIndices.size === duplicates.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(duplicates.map((_, i) => i)))
    }
  }

  const toggleOne = (idx: number) => {
    const newSet = new Set(selectedIndices)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setSelectedIndices(newSet)
  }

  // Delete selected duplicates
  const handleDelete = useCallback(async () => {
    if (selectedIndices.size === 0) {
      toast.error('You must choose at least one record.')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIndices.size} duplicate attendance record(s)? This action cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const result = await attendanceApi.deleteDuplicateAttendance({
        school_id: schoolId,
        campus_id: selectedCampus?.id
      })

      if (result.data) {
        toast.success(`The duplicate records have been deleted. (${result.data.deleted} removed)`)
        // Reload the list
        await loadDuplicates()
      } else {
        toast.error(result.error || 'Deletion failed')
      }
    } catch {
      toast.error('Deletion failed')
    } finally {
      setDeleting(false)
    }
  }, [selectedIndices, schoolId, loadDuplicates])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Delete Duplicate Attendance</h1>
        <Button
          onClick={handleDelete}
          disabled={deleting || selectedIndices.size === 0}
          className="gap-2"
        >
          {deleting ? (
            <IconLoader className="h-4 w-4 animate-spin" />
          ) : (
            <IconTrash className="h-4 w-4" />
          )}
          DELETE
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={duplicates.length === 0}
                      />
                    </TableHead>
                    <TableHead>Student (Studently ID)</TableHead>
                    <TableHead>Period (Period ID)</TableHead>
                    <TableHead>Attendance Date</TableHead>
                    <TableHead className="text-center">Duplicate Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="font-semibold text-center py-6">
                        No Duplicates Found
                      </TableCell>
                    </TableRow>
                  ) : (
                    duplicates.map((dup, idx) => (
                      <TableRow
                        key={idx}
                        className="cursor-pointer"
                        onClick={() => toggleOne(idx)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIndices.has(idx)}
                            onCheckedChange={() => toggleOne(idx)}
                          />
                        </TableCell>
                        <TableCell>
                          {dup.student_name || 'Unknown'}{' '}
                          <span className="text-muted-foreground text-xs">
                            ({dup.student_id.substring(0, 8)})
                          </span>
                        </TableCell>
                        <TableCell>
                          {dup.period_name || 'Unknown'}{' '}
                          <span className="text-muted-foreground text-xs">
                            ({dup.period_id.substring(0, 8)})
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(dup.attendance_date)}</TableCell>
                        <TableCell className="text-center font-semibold text-destructive">
                          {dup.count}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Bottom delete button when there are duplicates */}
          {duplicates.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleDelete}
                disabled={deleting || selectedIndices.size === 0}
                className="gap-2"
              >
                {deleting ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconTrash className="h-4 w-4" />
                )}
                DELETE
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
