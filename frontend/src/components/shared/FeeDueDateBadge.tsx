'use client'

import { differenceInCalendarDays, parseISO } from 'date-fns'

interface FeeDueDateBadgeProps {
  dueDate: string | null | undefined
  status: string
}

/**
 * Computes deadline urgency relative to today using the fee's due_date field
 * (not payment date), and renders a colored badge.
 *
 * Green  → Days Remaining: X
 * Yellow → Due Today
 * Red    → X Days Overdue
 *
 * Returns null for paid fees.
 */
export function FeeDueDateBadge({ dueDate, status }: FeeDueDateBadgeProps) {
  if (status === 'paid' || !dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = parseISO(dueDate)
  due.setHours(0, 0, 0, 0)

  const diff = differenceInCalendarDays(due, today)

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Days Remaining: {diff}
      </span>
    )
  }

  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
        Due Today
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
      {Math.abs(diff)} Days Overdue
    </span>
  )
}
