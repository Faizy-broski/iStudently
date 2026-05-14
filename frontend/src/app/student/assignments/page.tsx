'use client'

import { useState, useMemo } from 'react'
import { useStudentAssignments } from '@/hooks/useStudentDashboard'
import { format, parseISO } from 'date-fns'
import { Search, X, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'

function formatDate(d?: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'MMMM d yyyy') } catch { return d }
}

function teacherName(teacher: any) {
  if (!teacher?.profile) return '—'
  const p = teacher.profile
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
}

export default function StudentAssignmentsPage() {
  const { assignments, isLoading, error } = useStudentAssignments()
  const [search, setSearch] = useState('')

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          Error loading assignments: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} assignment{filtered.length !== 1 ? 's' : ''} found
          </p>
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
                  No assignments found
                </td>
              </tr>
            ) : (
              filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="text-[#4A90E2] hover:underline font-medium"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(a.due_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(a.assigned_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{a.subject?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{teacherName(a.teacher)}</td>
                  <td className="px-4 py-3 text-center">
                    {a.submission ? (
                      <Check className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
