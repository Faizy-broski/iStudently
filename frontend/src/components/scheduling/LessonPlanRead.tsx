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

import { useTranslations, useLocale } from "next-intl"

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(locale, {
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

function formatCoursePeriodLabel(cp: LessonPlanLesson["course_period"], tCommon: any): string {
  if (!cp) return tCommon("unknown")
  const parts: string[] = []
  if (cp.course?.title) parts.push(cp.course.title)
  if (cp.section?.name) parts.push(cp.section.name)
  if (cp.period?.short_name) parts.push(`P${cp.period.short_name}`)
  return parts.join(" — ") || cp.title || tCommon("unknown")
}

function formatTeacherName(lesson: LessonPlanLesson): string {
  const p = lesson.teacher?.profile || lesson.course_period?.teacher?.profile
  if (!p) return "—"
  return [p.first_name, p.last_name].filter(Boolean).join(" ")
}

function RichTextDisplay({ html, tCommon }: { html?: string; tCommon: any }) {
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
  const locale = useLocale()

  const t = useTranslations("school.scheduling.lesson_plan_read")
  const tCommon = useTranslations("common")

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
    if (timeframe === "all") return t("all_entries")
    if (timeframe === "day") return formatDate(currentDate.toISOString().split("T")[0], locale)
    if (timeframe === "week") {
      const range = getWeekRange(currentDate)
      return `${formatDate(range.date_from, locale)} — ${formatDate(range.date_to, locale)}`
    }
    return currentDate.toLocaleDateString(locale, { month: "long", year: "numeric" })
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
    ? formatCoursePeriodLabel(lessons[0].course_period, tCommon)
    : t("lessons_found", { count: 0 })

  if (!coursePeriodId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("msg_no_course")}</p>
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
                {t("lessons_found", { count: lessonList.length })}
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
                  <SelectItem value="all">{t("timeframe_all")}</SelectItem>
                  <SelectItem value="day">{t("timeframe_day")}</SelectItem>
                  <SelectItem value="week">{t("timeframe_week")}</SelectItem>
                  <SelectItem value="month">{t("timeframe_month")}</SelectItem>
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
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
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
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
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
            <p className="text-lg font-medium">{t("no_lessons_found")}</p>
            <p className="text-sm mt-1">
              {timeframe !== "all"
                ? t("no_lessons_tip_timeframe")
                : t("no_lessons_tip_none")}
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
                        {formatDate(lesson.on_date, locale)}
                      </span>
                      {lesson.length_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {t("label_min", { count: lesson.length_minutes })}
                        </span>
                      )}
                      <span>{t("label_teacher", { name: formatTeacherName(lesson) })}</span>
                      <span>{t("label_lesson_num", { num: lesson.lesson_number })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {files.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <FileText className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
                        {t("label_files", { count: files.length })}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {t("label_parts", { count: items.length })}
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
                        {t("h_objectives")}
                      </h4>
                      <RichTextDisplay html={lesson.learning_objectives} tCommon={tCommon} />
                    </div>
                  )}

                  {/* Lesson Parts Table */}
                  {items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">
                        {t("h_parts")}
                      </h4>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20 text-left rtl:text-right">{t("th_time")}</TableHead>
                              <TableHead className="text-left rtl:text-right">
                                {t("th_content")}
                              </TableHead>
                              <TableHead className="text-left rtl:text-right">{t("th_learner")}</TableHead>
                              <TableHead className="text-left rtl:text-right">{t("th_assessment")}</TableHead>
                              <TableHead className="text-left rtl:text-right">
                                {t("th_materials")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="align-top font-mono text-sm">
                                  {item.time_minutes
                                    ? t("label_min", { count: item.time_minutes })
                                    : "—"}
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.teacher_activity}
                                    tCommon={tCommon}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.learner_activity}
                                    tCommon={tCommon}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.formative_assessment}
                                    tCommon={tCommon}
                                  />
                                </TableCell>
                                <TableCell className="align-top">
                                  <RichTextDisplay
                                    html={item.learning_materials}
                                    tCommon={tCommon}
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
                        {t("h_evaluation")}
                      </h4>
                      <div className="rounded-md border p-4 bg-muted/30">
                        <RichTextDisplay html={lesson.evaluation} tCommon={tCommon} />
                      </div>
                    </div>
                  )}

                  {/* Inclusiveness */}
                  {lesson.inclusiveness && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        {t("h_inclusiveness")}
                      </h4>
                      <div className="rounded-md border p-4 bg-muted/30">
                        <RichTextDisplay html={lesson.inclusiveness} tCommon={tCommon} />
                      </div>
                    </div>
                  )}

                  {/* File Attachments */}
                  {files.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">
                        {t("h_attachments")}
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
                              <span className="text-xs text-muted-foreground ml-auto rtl:mr-auto rtl:ml-0">
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
