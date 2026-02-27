'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/staff-absences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Search, CalendarOff, Filter } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
}

function formatDate(dt: string) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function daysAbsent(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0.5, Math.round(diff / (1000 * 60 * 60 * 24) * 10) / 10)
}

export default function AbsencesPage() {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const router = useRouter()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const [startDate, setStartDate] = useState(monthStart)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    schoolId
      ? ['staff-absences', schoolId, campusId, startDate, endDate, statusFilter]
      : null,
    () =>
      api.getAbsences({
        school_id: schoolId,
        campus_id: campusId,
        start_date: startDate,
        end_date: endDate,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
  )

  const absences = (data?.data || []).filter((a) => {
    if (!search) return true
    return a.staff_name?.toLowerCase().includes(search.toLowerCase())
  })

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    const res = await api.deleteAbsence(deleteId)
    setDeleting(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Absence deleted')
      mutate()
    }
    setDeleteId(null)
  }, [deleteId, mutate])

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarOff className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Staff Absences</h1>
        </div>
        <Button onClick={() => router.push('/admin/staff-absences/add-absence')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Absence
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <label className="text-xs text-muted-foreground">Search staff</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => mutate()}>
              <Filter className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : absences.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                        No absences found for the selected period.
                      </TableCell>
                    </TableRow>
                  )
                : absences.map((absence) => (
                    <TableRow key={absence.id}>
                      <TableCell className="font-medium">
                        {absence.staff_name || '—'}
                      </TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">
                        {absence.staff_role || '—'}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(absence.start_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(absence.end_date)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {daysAbsent(absence.start_date, absence.end_date)}
                      </TableCell>
                      <TableCell className="text-sm max-w-40 truncate">
                        {absence.reason || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[absence.status] || ''}
                        >
                          {absence.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              router.push(`/admin/staff-absences/edit/${absence.id}`)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(absence.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {absences.length} absence{absences.length !== 1 ? 's' : ''} found
      </p>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Absence</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this absence? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
