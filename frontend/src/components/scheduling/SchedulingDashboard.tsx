"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { getSchedulingDashboardStats } from "@/lib/api/scheduling"
import { getMarkingPeriods, type MarkingPeriodOption } from "@/lib/api/grades"
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  BarChart3,
  GraduationCap,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export function SchedulingDashboard() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const academicYearId = selectedAcademicYear

  // Fetch dashboard stats
  const { data: stats, isLoading } = useSWR(
    user && academicYearId ? ["scheduling-dashboard-stats", academicYearId] : null,
    async () => getSchedulingDashboardStats(academicYearId!),
    { revalidateOnFocus: false }
  )

  // Fetch marking periods for context
  const { data: mps } = useSWR(
    user && academicYearId ? ["scheduling-dashboard-mps", academicYearId] : null,
    async () => {
      const res = await getMarkingPeriods(academicYearId!)
      if (!res.success) throw new Error(res.error || "Failed")
      return (res.data || []) as MarkingPeriodOption[]
    },
    { revalidateOnFocus: false }
  )

  const fillPercent = useMemo(() => {
    if (!stats || !stats.total_seats) return 0
    return Math.round((stats.total_filled / stats.total_seats) * 100)
  }, [stats])

  const cards = useMemo(() => {
    if (!stats) return []
    return [
      {
        label: "Subjects",
        value: stats.total_subjects,
        icon: BookOpen,
        color: "text-blue-600 bg-blue-50",
      },
      {
        label: "Courses",
        value: stats.total_courses,
        icon: Layers,
        color: "text-emerald-600 bg-emerald-50",
      },
      {
        label: "Course Periods",
        value: stats.total_course_periods,
        icon: BarChart3,
        color: "text-amber-600 bg-amber-50",
      },
      {
        label: "Students Enrolled",
        value: stats.total_students_enrolled,
        icon: GraduationCap,
        color: "text-purple-600 bg-purple-50",
      },
      {
        label: "Total Seats",
        value: stats.total_seats,
        icon: Users,
        color: "text-rose-600 bg-rose-50",
      },
      {
        label: "Filled Seats",
        value: stats.total_filled,
        icon: Users,
        color: "text-teal-600 bg-teal-50",
      },
    ]
  }, [stats])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <LayoutDashboard className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Scheduling Dashboard</h1>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border bg-card p-4 flex flex-col items-center gap-2 shadow-sm"
            >
              <div className={`rounded-full p-2 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold">{card.value}</span>
              <span className="text-xs text-muted-foreground text-center">{card.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Seat Utilization Bar */}
      {stats && stats.total_seats > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Overall Seat Utilization
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  fillPercent >= 90
                    ? "bg-red-500"
                    : fillPercent >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(fillPercent, 100)}%` }}
              />
            </div>
            <span className="text-sm font-semibold w-14 text-right">{fillPercent}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.total_filled} of {stats.total_seats} seats filled
            {stats.total_seats - stats.total_filled > 0 && (
              <> &mdash; {stats.total_seats - stats.total_filled} seats available</>
            )}
          </p>
        </div>
      )}

      {/* Marking Periods Overview */}
      {mps && mps.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Active Marking Periods
          </h2>
          <div className="flex flex-wrap gap-2">
            {mps.map((mp) => (
              <span
                key={mp.id}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
              >
                {mp.short_name || mp.title}
                <span className="ml-1.5 text-muted-foreground">({mp.mp_type})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
