"use client"

import { useState, useRef } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import { useTranslations, useLocale } from "next-intl"
import {
  getLessonPlans,
  getLessonPlanById,
  createLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  replaceLessonItems,
  addLessonFile,
  removeLessonFile,
  type LessonPlanLesson,
  type LessonPlanItem,
  type CreateLessonItemDTO,
} from "@/lib/api/lesson-plans"
import { getCoursePeriods, type CoursePeriod } from "@/lib/api/grades"
import { createClient } from "@/lib/supabase/client"
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Upload,
  X,
  FileText,
  ArrowUp,
  ArrowDown,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

// ==================
// Types for form state
// ==================

interface LessonFormData {
  title: string
  on_date: string
  lesson_number: number
  length_minutes: number | ""
  learning_objectives: string
  evaluation: string
  inclusiveness: string
}

interface ItemFormData {
  id?: string
  sort_order: number
  time_minutes: number | ""
  teacher_activity: string
  learner_activity: string
  formative_assessment: string
  learning_materials: string
}

function emptyItem(sortOrder: number): ItemFormData {
  return {
    sort_order: sortOrder,
    time_minutes: "",
    teacher_activity: "",
    learner_activity: "",
    formative_assessment: "",
    learning_materials: "",
  }
}

function emptyLesson(): LessonFormData {
  return {
    title: "",
    on_date: new Date().toISOString().split("T")[0],
    lesson_number: 1,
    length_minutes: "",
    learning_objectives: "",
    evaluation: "",
    inclusiveness: "",
  }
}

function formatCoursePeriodLabel(cp: CoursePeriod | Record<string, unknown>): string {
  const c = cp as Record<string, any>
  const parts: string[] = []
  if (c.course?.title) parts.push(c.course.title)
  else if (c.title) parts.push(c.title as string)
  if (c.section?.name) parts.push(c.section.name)
  if (c.period?.short_name) parts.push(`P${c.period.short_name}`)
  return parts.join(" — ") || (c.short_name as string) || "Course Period"
}

// ==================
// Main Component
// ==================

export default function LessonPlanAdd() {
  const t = useTranslations("school.scheduling.lesson_plan_add")
  const tCommon = useTranslations("common")
  const locale = useLocale()

  const { user, profile } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()

  const teacherId = profile?.staff_id || ""
  const campusId = campusContext?.selectedCampus?.id

  // State
  const [selectedCpId, setSelectedCpId] = useState<string>("")
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lessonForm, setLessonForm] = useState<LessonFormData>(emptyLesson())
  const [itemsForm, setItemsForm] = useState<ItemFormData[]>([emptyItem(0)])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch course periods for this teacher
  const { data: coursePeriods, isLoading: cpLoading } = useSWR<CoursePeriod[]>(
    user && teacherId
      ? ["teacher-course-periods", user.id, campusId]
      : null,
    async () => {
      const res = await getCoursePeriods(campusId)
      if (!res.success) throw new Error(res.error || "Failed to fetch")
      // Filter to teacher's course periods only
      const all = (res.data || []) as Array<CoursePeriod & { teacher_id?: string }>
      return teacherId
        ? all.filter((cp) => cp.teacher_id === teacherId)
        : all
    },
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  // Fetch existing lessons for selected course period
  const {
    data: existingLessons,
    isLoading: lessonsLoading,
    mutate: mutateLessons,
  } = useSWR<LessonPlanLesson[]>(
    user && selectedCpId
      ? [
          "teacher-lesson-plans",
          selectedCpId,
          selectedAcademicYear,
          campusId,
        ]
      : null,
    async () => {
      const res = await getLessonPlans({
        course_period_id: selectedCpId,
        academic_year_id: selectedAcademicYear || undefined,
        campus_id: campusId,
        limit: 200,
      })
      if (!res.success) throw new Error(res.error || "Failed to fetch")
      return res.data || []
    },
    { revalidateOnFocus: false }
  )

  // Open form for new lesson
  function handleNewLesson() {
    setEditingLessonId(null)
    const nextNum = (existingLessons?.length || 0) + 1
    setLessonForm({ ...emptyLesson(), lesson_number: nextNum })
    setItemsForm([emptyItem(0)])
    setShowForm(true)
  }

  // Open form for editing
  async function handleEditLesson(lesson: LessonPlanLesson) {
    setEditingLessonId(lesson.id)
    setLessonForm({
      title: lesson.title,
      on_date: lesson.on_date,
      lesson_number: lesson.lesson_number,
      length_minutes: lesson.length_minutes || "",
      learning_objectives: lesson.learning_objectives || "",
      evaluation: lesson.evaluation || "",
      inclusiveness: lesson.inclusiveness || "",
    })
    const items = (lesson.items || []).map((item) => ({
      id: item.id,
      sort_order: item.sort_order,
      time_minutes: item.time_minutes || ("" as number | ""),
      teacher_activity: item.teacher_activity || "",
      learner_activity: item.learner_activity || "",
      formative_assessment: item.formative_assessment || "",
      learning_materials: item.learning_materials || "",
    }))
    setItemsForm(items.length > 0 ? items : [emptyItem(0)])
    setShowForm(true)
  }

  // Add lesson part row
  function addItemRow() {
    setItemsForm((prev) => [...prev, emptyItem(prev.length)])
  }

  // Remove lesson part row
  function removeItemRow(index: number) {
    setItemsForm((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next.map((item, i) => ({ ...item, sort_order: i })) : [emptyItem(0)]
    })
  }

  // Move item row up/down
  function moveItemRow(index: number, direction: -1 | 1) {
    setItemsForm((prev) => {
      const next = [...prev]
      const newIndex = index + direction
      if (newIndex < 0 || newIndex >= next.length) return prev
      const temp = next[index]
      next[index] = next[newIndex]
      next[newIndex] = temp
      return next.map((item, i) => ({ ...item, sort_order: i }))
    })
  }

  // Update item field
  function updateItem(index: number, field: keyof ItemFormData, value: string | number) {
    setItemsForm((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  // Save lesson
  async function handleSave() {
    if (!selectedCpId || !selectedAcademicYear || !teacherId) {
      toast.error(t("msg_cp_required"))
      return
    }
    if (!lessonForm.title.trim()) {
      toast.error(t("msg_title_required"))
      return
    }
    if (!lessonForm.on_date) {
      toast.error(t("msg_date_required"))
      return
    }

    setSaving(true)
    try {
      const items: CreateLessonItemDTO[] = itemsForm
        .filter(
          (item) =>
            item.teacher_activity ||
            item.learner_activity ||
            item.formative_assessment ||
            item.learning_materials ||
            item.time_minutes
        )
        .map((item, i) => ({
          sort_order: i,
          time_minutes: item.time_minutes ? Number(item.time_minutes) : undefined,
          teacher_activity: item.teacher_activity || undefined,
          learner_activity: item.learner_activity || undefined,
          formative_assessment: item.formative_assessment || undefined,
          learning_materials: item.learning_materials || undefined,
        }))

      if (editingLessonId) {
        // Update existing lesson
        const res = await updateLessonPlan(editingLessonId, {
          title: lessonForm.title,
          on_date: lessonForm.on_date,
          lesson_number: lessonForm.lesson_number,
          length_minutes: lessonForm.length_minutes ? Number(lessonForm.length_minutes) : undefined,
          learning_objectives: lessonForm.learning_objectives || undefined,
          evaluation: lessonForm.evaluation || undefined,
          inclusiveness: lessonForm.inclusiveness || undefined,
        })
        if (!res.success) throw new Error(res.error)

        // Replace items
        if (items.length > 0 || (existingLessons?.find((l) => l.id === editingLessonId)?.items?.length || 0) > 0) {
          const itemsRes = await replaceLessonItems(editingLessonId, items)
          if (!itemsRes.success) throw new Error(itemsRes.error)
        }

        toast.success(t("msg_updated"))
      } else {
        // Create new lesson
        const res = await createLessonPlan({
          course_period_id: selectedCpId,
          teacher_id: teacherId,
          academic_year_id: selectedAcademicYear,
          title: lessonForm.title,
          on_date: lessonForm.on_date,
          lesson_number: lessonForm.lesson_number,
          length_minutes: lessonForm.length_minutes ? Number(lessonForm.length_minutes) : undefined,
          learning_objectives: lessonForm.learning_objectives || undefined,
          evaluation: lessonForm.evaluation || undefined,
          inclusiveness: lessonForm.inclusiveness || undefined,
          campus_id: campusId,
          items,
        })
        if (!res.success) throw new Error(res.error)

        toast.success(t("msg_created"))
      }

      setShowForm(false)
      mutateLessons()
      // Invalidate summary caches
      globalMutate(
        (key: unknown) => Array.isArray(key) && key[0] === "lesson-plan-summary",
        undefined,
        { revalidate: true }
      )
    } catch (err: any) {
      toast.error(err.message || tCommon("error"))
    } finally {
      setSaving(false)
    }
  }

  // Delete lesson
  async function handleDelete(lessonId: string) {
    setDeleting(lessonId)
    try {
      const res = await deleteLessonPlan(lessonId)
      if (!res.success) throw new Error(res.error)
      toast.success(t("msg_deleted"))
      mutateLessons()
      globalMutate(
        (key: unknown) => Array.isArray(key) && key[0] === "lesson-plan-summary",
        undefined,
        { revalidate: true }
      )
    } catch (err: any) {
      toast.error(err.message || tCommon("error"))
    } finally {
      setDeleting(null)
    }
  }

  // File upload
  async function handleFileUpload(lessonId: string, file: File) {
    setUploadingFile(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const filePath = `${profile?.school_id || "unknown"}/${lessonId}/${fileName}`

      const { data, error } = await supabase.storage
        .from("lesson-plan-files")
        .upload(filePath, file, { cacheControl: "3600", upsert: false })

      if (error) throw new Error(error.message)

      const {
        data: { publicUrl },
      } = supabase.storage.from("lesson-plan-files").getPublicUrl(data.path)

      const res = await addLessonFile(lessonId, {
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
      })

      if (!res.success) throw new Error(res.error)
      toast.success(t("msg_file_uploaded"))
      mutateLessons()
    } catch (err: any) {
      toast.error(err.message || tCommon("error"))
    } finally {
      setUploadingFile(false)
    }
  }

  // Remove file
  async function handleRemoveFile(fileId: string) {
    try {
      const res = await removeLessonFile(fileId)
      if (!res.success) throw new Error(res.error)
      toast.success(t("msg_file_removed"))
      mutateLessons()
    } catch (err: any) {
      toast.error(err.message || tCommon("error"))
    }
  }

  // Loading state
  if (cpLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const cpList = coursePeriods || []

  return (
    <div className="space-y-6 p-6">
      {/* Header & Course Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <CardDescription>
            {t("desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="mb-1.5 block text-sm">{tCommon("course_period")}</Label>
              <Select value={selectedCpId} onValueChange={setSelectedCpId}>
                <SelectTrigger>
                  <SelectValue placeholder={tCommon("select_course_period")} />
                </SelectTrigger>
                <SelectContent>
                  {cpList.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {t("no_cp_assigned")}
                    </SelectItem>
                  ) : (
                    cpList.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {formatCoursePeriodLabel(cp)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedCpId && (
              <Button onClick={handleNewLesson} disabled={showForm}>
                <Plus className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" />
                {t("new_lesson")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lesson Form */}
      {showForm && (
        <Card className="max-w-5xl">
          <CardHeader>
            <CardTitle>
              {editingLessonId ? t("edit_lesson") : t("new_lesson_plan")}
            </CardTitle>
            <CardDescription>
              {t("form_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <Label htmlFor="lp-title">{t("lesson_title")}</Label>
                <Input
                  id="lp-title"
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, title: e.target.value })
                  }
                  placeholder={t("placeholder_title")}
                />
              </div>
              <div>
                <Label htmlFor="lp-date">{tCommon("date")} *</Label>
                <Input
                  id="lp-date"
                  type="date"
                  value={lessonForm.on_date}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, on_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="lp-num">{t("lesson_num")}</Label>
                <Input
                  id="lp-num"
                  type="number"
                  min={1}
                  value={lessonForm.lesson_number}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      lesson_number: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="lp-length">{t("length_min")}</Label>
                <Input
                  id="lp-length"
                  type="number"
                  min={1}
                  value={lessonForm.length_minutes}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      length_minutes: e.target.value ? parseInt(e.target.value) : "",
                    })
                  }
                  placeholder="e.g. 45"
                />
              </div>
            </div>

            {/* Learning Objectives */}
            <div>
              <Label className="mb-1.5 block">{t("learning_objectives")}</Label>
              <RichTextEditor
                value={lessonForm.learning_objectives}
                onChange={(html) =>
                  setLessonForm({ ...lessonForm, learning_objectives: html })
                }
                placeholder={t("desc_objectives")}
                campusId={campusId}
                showEditorPlugins
              />
            </div>

            <Separator />

            {/* Lesson Parts Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">{t("lesson_parts")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                >
                  <Plus className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" />
                  {t("add_part")}
                </Button>
              </div>
              <div className="space-y-4">
                {itemsForm.map((item, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {t("part_label", { num: idx + 1 })}
                      </Badge>
                      <div className="flex items-center gap-1 ml-auto rtl:mr-auto rtl:ml-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => moveItemRow(idx, -1)}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => moveItemRow(idx, 1)}
                          disabled={idx === itemsForm.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeItemRow(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                      <div>
                        <Label className="text-xs">{t("time_min")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.time_minutes}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "time_minutes",
                              e.target.value ? parseInt(e.target.value) : ""
                            )
                          }
                          placeholder="e.g. 10"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {t("teacher_activity")}
                        </Label>
                        <RichTextEditor
                          value={item.teacher_activity}
                          onChange={(html) =>
                            updateItem(idx, "teacher_activity", html)
                          }
                          placeholder={t("teacher_activity") + "..."}
                          minHeight="80px"
                          campusId={campusId}
                          showEditorPlugins
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t("learner_activity")}</Label>
                        <RichTextEditor
                          value={item.learner_activity}
                          onChange={(html) =>
                            updateItem(idx, "learner_activity", html)
                          }
                          placeholder={t("learner_activity") + "..."}
                          minHeight="80px"
                          campusId={campusId}
                          showEditorPlugins
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t("formative_assessment")}</Label>
                        <RichTextEditor
                          value={item.formative_assessment}
                          onChange={(html) =>
                            updateItem(idx, "formative_assessment", html)
                          }
                          placeholder={t("formative_assessment") + "..."}
                          minHeight="80px"
                          campusId={campusId}
                          showEditorPlugins
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {t("learning_materials")}
                        </Label>
                        <RichTextEditor
                          value={item.learning_materials}
                          onChange={(html) =>
                            updateItem(idx, "learning_materials", html)
                          }
                          placeholder={t("learning_materials") + "..."}
                          minHeight="80px"
                          campusId={campusId}
                          showEditorPlugins
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Premium Fields */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">
                  {t("lesson_evaluation")}
                </Label>
                <RichTextEditor
                  value={lessonForm.evaluation}
                  onChange={(html) =>
                    setLessonForm({ ...lessonForm, evaluation: html })
                  }
                  placeholder={t("lesson_evaluation") + "..."}
                  campusId={campusId}
                  showEditorPlugins
                />
              </div>
              <div>
                <Label className="mb-1.5 block">{t("inclusiveness")}</Label>
                <RichTextEditor
                  value={lessonForm.inclusiveness}
                  onChange={(html) =>
                    setLessonForm({ ...lessonForm, inclusiveness: html })
                  }
                  placeholder={t("inclusiveness") + "..."}
                  campusId={campusId}
                  showEditorPlugins
                />
              </div>
            </div>

          <div className="p-6 pt-0 flex justify-end gap-2 rtl:flex-row-reverse">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1 rtl:ml-1 rtl:mr-0" />
              )}
              {editingLessonId ? tCommon("update") : tCommon("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Existing Lessons List */}
      {selectedCpId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("existing_lessons")}</CardTitle>
            <CardDescription>
              {lessonsLoading
                ? tCommon("loading")
                : t("found_lessons", { count: existingLessons?.length || 0 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lessonsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !existingLessons?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{t("no_lessons_yet")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {existingLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        #{lesson.lesson_number} — {lesson.title}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>
                          {new Date(
                            lesson.on_date + "T00:00:00"
                          ).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                        </span>
                        {lesson.length_minutes && (
                          <span>{lesson.length_minutes} {tCommon("min")}</span>
                        )}
                        <span>
                          {tCommon("count_parts", { count: lesson.items?.length || 0 })}
                        </span>
                        {(lesson.files?.length || 0) > 0 && (
                          <span>
                            {tCommon("count_files", { count: lesson.files!.length })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rtl:flex-row-reverse">
                      {/* File upload button */}
                      <Button
                        variant="outline"
                        size="sm"
                        title={tCommon("upload")}
                        disabled={uploadingFile}
                        onClick={() => {
                          // Store lesson id, then trigger file input
                          const input = document.createElement("input")
                          input.type = "file"
                          input.accept =
                            "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement)
                              .files?.[0]
                            if (file) handleFileUpload(lesson.id, file)
                          }
                          input.click()
                        }}
                      >
                        {uploadingFile ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title={tCommon("edit")}
                        onClick={() => handleEditLesson(lesson)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title={tCommon("delete")}
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(lesson.id)}
                        disabled={deleting === lesson.id}
                      >
                        {deleting === lesson.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Show files for lessons that have them */}
                {existingLessons
                  .filter((l) => l.files && l.files.length > 0)
                  .map((lesson) => (
                    <div
                      key={`files-${lesson.id}`}
                      className="ml-4 pl-4 border-l-2 space-y-1"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        Files for &quot;{lesson.title}&quot;:
                      </p>
                      {lesson.files!.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline text-primary"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {f.file_name}
                          </a>
                          {f.file_size && (
                            <span className="text-muted-foreground text-xs">
                              ({(f.file_size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => handleRemoveFile(f.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
