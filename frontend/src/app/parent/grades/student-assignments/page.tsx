'use client'

import { useMemo, useState } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useParentStudentAssignments } from '@/hooks/useParentDashboard'
import { format, parseISO } from 'date-fns'
import { Search, Check, X, Loader2, GraduationCap, ClipboardList } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(d?: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'MMMM d yyyy') } catch { return d }
}

function teacherName(teacher: any) {
  if (!teacher?.profile) return '—'
  const p = teacher.profile
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ParentStudentAssignmentsPage() {
  const { selectedStudent, selectedStudentData, isLoading: studentLoading } = useParentDashboard()
  const { assignments, isLoading, error } = useParentStudentAssignments()
  const [search, setSearch] = useState('')

  // Merge all status buckets into one flat list (same as student page)
  const allAssignments = useMemo(() => [
    ...assignments.todo,
    ...assignments.submitted,
    ...assignments.graded,
  ], [assignments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allAssignments
    return allAssignments.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.subject?.name?.toLowerCase().includes(q) ||
      teacherName(a.teacher).toLowerCase().includes(q)
    )
  }, [allAssignments, search])

  // ── guard: no student selected ────────────────────────────────────────────
  if (studentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudent || !selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view their assignments.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" />
      </div>
    )
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          Error loading assignments: {error.message}
        </div>
      </div>
    )
  }

  const studentName = [selectedStudentData.first_name, selectedStudentData.last_name]
    .filter(Boolean).join(' ')

  // ── summary counts ────────────────────────────────────────────────────────
  const pendingCount  = assignments.todo.length
  const submittedCount = assignments.submitted.length + assignments.graded.length
  const overdueCount = assignments.todo.filter(a => {
    if (!a.due_date) return false
    return new Date(a.due_date) < new Date()
  }).length

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-[#57A3CC]" />
          Assignments
        </h1>
        <p className="text-muted-foreground mt-1">
          {studentName}&apos;s homework and assignments
          <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
        </p>
      </div>

      {/* Summary cards — same layout as student page */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-3xl font-bold text-orange-500">{pendingCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-3xl font-bold text-green-600">{submittedCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-3xl font-bold text-red-500">{overdueCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Table + search */}
      <div>
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="h-4 w-4" />
            All Assignments
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2] bg-white w-52"
            />
          </div>
        </div>

        {/* Table */}
        <div className="border border-gray-200 rounded overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="text-left px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Due Date</th>
                <th className="text-left px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Assigned Date</th>
                <th className="text-left px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Course Title</th>
                <th className="text-left px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Teacher</th>
                <th className="text-center px-4 py-3 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    {allAssignments.length === 0
                      ? 'No assignments found'
                      : 'No assignments match your search'}
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/parent/grades/student-assignments/${a.id}`}
                        className="text-[#4A90E2] hover:underline font-medium"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(a.due_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate((a as any).assigned_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{a.subject?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{teacherName(a.teacher)}</td>
                    <td className="px-4 py-3 text-center">
                      {a.submission ? (
                        <Check className="h-5 w-5 text-green-600 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-red-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {filtered.length} assignment{filtered.length !== 1 ? 's' : ''} shown · read-only view
        </p>
      </div>
    </div>
  )
}
