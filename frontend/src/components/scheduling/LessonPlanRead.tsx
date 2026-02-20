"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import {
  getLessonPlans,
  type LessonPlanLesson,
} from "@/lib/api/lesson-plans"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  FileText,
  Download,
  Loader2,
} from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type TimeframeMode = "day" | "week" | "month" | "all"

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getWeekRange(date: Date): { date_from: string; date_to: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    date_from: monday.toISOString().split("T")[0],
    date_to: sunday.toISOString().split("T")[0],
  }
}

function getMonthRange(date: Date): { date_from: string; date_to: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return {
    date_from: first.toISOString().split("T")[0],
    date_to: last.toISOString().split("T")[0],
  }
}

function formatCoursePeriodLabel(cp: LessonPlanLesson["course_period"]): string {
  if (!cp) return "Unknown"
  const parts: string[] = []
  if (cp.course?.title) parts.push(cp.course.title)
  if (cp.section?.name) parts.push(cp.section.name)
  if (cp.period?.short_name) parts.push(`P${cp.period.short_name}`)
  return parts.join(" — ") || cp.title || "Unknown"
}

function formatTeacherName(lesson: LessonPlanLesson): string {
  const p = lesson.teacher?.profile || lesson.course_period?.teacher?.profile
  if (!p) return "—"
  return [p.first_name, p.last_name].filter(Boolean).join(" ")
}

function RichTextDisplay({ html }: { html?: string }) {
  if (!html) return <span className="text-muted-foreground italic">—</span>
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function LessonPlanRead() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()

  // Read course_period_id from URL
  const [coursePeriodId, setCoursePeriodId] = useState<string>("")
  const [timeframe, setTimeframe] = useState<TimeframeMode>("all")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cpId = params.get("course_period_id")
    if (cpId) setCoursePeriodId(cpId)
  }, [])

  // Build date filters based on timeframe
  function getDateFilters(): { date_from?: string; date_to?: string; on_date?: string } {
    if (timeframe === "all") return {}
    if (timeframe === "day") {
      return { on_date: currentDate.toISOString().split("T")[0] }
    }
    if (timeframe === "week") {
      return getWeekRange(currentDate)
    }
    return getMonthRange(currentDate)
  }

  function navigateDate(direction: -1 | 1) {
    const d = new Date(currentDate)
    if (timeframe === "day") d.setDate(d.getDate() + direction)
    else if (timeframe === "week") d.setDate(d.getDate() + direction * 7)
    else if (timeframe === "month") d.setMonth(d.getMonth() + direction)
    setCurrentDate(d)
  }

  function getTimeframeLabel(): string {
    if (timeframe === "all") return "All Entries"
    if (timeframe === "day") return formatDate(currentDate.toISOString().split("T")[0])
    if (timeframe === "week") {
      const range = getWeekRange(currentDate)
      return `${formatDate(range.date_from)} — ${formatDate(range.date_to)}`
    }
    return currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  }

  const dateFilters = getDateFilters()

  const { data: lessons, isLoading } = useSWR<LessonPlanLesson[]>(
    user && coursePeriodId
      ? [
          "lesson-plan-read",
          coursePeriodId,
          selectedAcademicYear,
          campusContext?.selectedCampus?.id,
          timeframe,
          dateFilters.on_date,
          dateFilters.date_from,
          dateFilters.date_to,
        ]
      : null,
    async () => {
      const res = await getLessonPlans({
        course_period_id: coursePeriodId,
        academic_year_id: selectedAcademicYear || undefined,
        campus_id: campusContext?.selectedCampus?.id,
        ...dateFilters,
        limit: 100,
      })
      if (!res.success) throw new Error(res.error || "Failed to fetch")
      return res.data || []
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const courseLabel = lessons?.[0]
    ? formatCoursePeriodLabel(lessons[0].course_period)
    : "Lesson Plan"

  if (!coursePeriodId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No course period selected. Please select from the Lesson Plans list.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-96" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const lessonList = lessons || []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {courseLabel}
              </CardTitle>
              <CardDescription>
                {lessonList.length} lesson{lessonList.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>

            {/* Timeframe Controls */}
            <div className="flex items-center gap-2">
              <Select
                value={timeframe}
                onValueChange={(v) => setTimeframe(v as TimeframeMode)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>

              {timeframe !== "all" && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateDate(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-32 text-center">
                    {getTimeframeLabel()}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateDate(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lessons */}
      {lessonList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No Lessons Found</p>
            <p className="text-sm mt-1">
              {timeframe !== "all"
                ? "Try changing the timeframe or navigating to a different date."
                : "No lesson plans have been created for this course period yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        lessonList.map((lesson) => {
          const isExpanded = expandedLesson === lesson.id
          const items = lesson.items || []
          const files = lesson.files || []

          return (
            <Card key={lesson.id} className="overflow-hidden">
              {/* Lesson Header — always visible */}
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() =>
                  setExpandedLesson(isExpanded ? null : lesson.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{lesson.title}</CardTitle>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(lesson.on_date)}
                      </span>
                      {lesson.length_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {lesson.length_minutes} min
                        </span>
                      )}
                      <span>Teacher: {formatTeacherName(lesson)}</span>
                      <span>Lesson #{lesson.lesson_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {files.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        {files.length} file{files.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {items.length} part{items.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="pt-0 space-y-6">
                  <Separator />

                  {/* Learning Objectives */}
                  {lesson.learning_objectives && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Learning Objectives
                      </h4>
                      <RichTextDisplay html={lesson.learning_objectives} />
                    </div>
                  )}

                  {/* Lesson Parts Table */}
                  {items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">
                        Lesson Parts
                      </h4>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20">Time</TableHead>
                              <TableHead>
                                Content &amp; Teacher Activity
                              </TableHead>
                              <TableHead>Learner Activity</TableHead>
                              <TableHead>Formative Assessment</TableHead>
                              <TableHead>
                                Learning Materials &amp; Resources
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="align-top font-mono text-sm">
                                  {item.time_minutes
                                    ? `${item.time_minutes} min`
                                    : "—"}
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.teacher_activity}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.learner_activity}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.formative_assessment}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.learning_materials}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Evaluation */}
                  {lesson.evaluation && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Lesson Evaluation (Past Lesson)
                      </h4>
                      <div className="rounded-md border p-4 bg-muted/30">
                        <RichTextDisplay html={lesson.evaluation} />
                      </div>
                    </div>
                  )}

                  {/* Inclusiveness */}
                  {lesson.inclusiveness && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Inclusiveness
                      </h4>
                      <div className="rounded-md border p-4 bg-muted/30">
                        <RichTextDisplay html={lesson.inclusiveness} />
                      </div>
                    </div>
                  )}

                  {/* File Attachments */}
                  {files.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        Attachments
                      </h4>
                      <div className="space-y-2">
                        {files.map((f) => (
                          <a
                            key={f.id}
                            href={f.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {f.file_name}
                            </span>
                            {f.file_size && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {(f.file_size / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
