"use client"

import { useState } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import {
  getLessonPlanSummary,
  type LessonPlanSummaryItem,
} from "@/lib/api/lesson-plans"
import { BookOpen, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatCoursePeriodLabel(cp: LessonPlanSummaryItem["course_period"]): string {
  if (!cp) return "Unknown"
  const parts: string[] = []
  if (cp.course?.title) parts.push(cp.course.title)
  if (cp.section?.name) parts.push(cp.section.name)
  if (cp.period?.short_name) parts.push(`P${cp.period.short_name}`)
  return parts.join(" — ") || cp.title || "Unknown"
}

function formatTeacherName(cp: LessonPlanSummaryItem["course_period"]): string {
  const p = cp?.teacher?.profile
  if (!p) return "—"
  return [p.first_name, p.last_name].filter(Boolean).join(" ")
}

interface LessonPlansListProps {
  readBasePath?: string
}

export default function LessonPlansList({ readBasePath = "/admin/scheduling/lesson-plan-read" }: LessonPlansListProps) {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const [_, setNavTo] = useState("")

  const { data: summaryItems, isLoading } = useSWR<LessonPlanSummaryItem[]>(
    user
      ? [
          "lesson-plan-summary",
          user.id,
          selectedAcademicYear,
          campusContext?.selectedCampus?.id,
        ]
      : null,
    async () => {
      const res = await getLessonPlanSummary({
        academic_year_id: selectedAcademicYear || undefined,
        campus_id: campusContext?.selectedCampus?.id,
      })
      if (!res.success) throw new Error(res.error || "Failed to fetch")
      return res.data || []
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  function handleReadClick(coursePeriodId: string) {
    const url = `${readBasePath}?course_period_id=${coursePeriodId}`
    setNavTo(url)
    window.location.href = url
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const items = summaryItems || []

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lesson Plans
          </CardTitle>
          <CardDescription>
            Overview of lesson plans by course period. Click &quot;Read&quot; to view lesson details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Lesson Plans Yet</p>
              <p className="text-sm mt-1">
                Lesson plans will appear here once teachers create them.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject / Course Period</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-center">Entries</TableHead>
                  <TableHead>Last Entry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.course_period_id}>
                    <TableCell className="font-medium">
                      {formatCoursePeriodLabel(item.course_period)}
                    </TableCell>
                    <TableCell>{formatTeacherName(item.course_period)}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {item.count}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.last_date
                        ? new Date(item.last_date + "T00:00:00").toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReadClick(item.course_period_id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Read
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
