"use client"

// Shared browse/manage view for the Qirtasi "My Worksheet" module, used by
// every role's page (admin/teacher/librarian get canUpload=true,
// student/parent get canUpload=false — server-side role checks are the real
// gate). Curriculum-tree filters (grade -> subject) are the primary
// discovery path per the spec's §9.2, alongside free-text search.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import { FileStack, Search, Plus, Download, FileText, Pencil, Trash2, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  listWorksheets, deleteWorksheet, getWorksheetDownloadUrl, getWorksheetThumbnailUrl,
  getWorksheetAnswerKeyUrl, getWorksheet, type QirtasiWorksheet, type QirtasiWorksheetDetail,
} from "@/lib/api/worksheets"
import { listCurriculumNodes, type CurriculumNode } from "@/lib/api/qirtasi-curriculum"
import { UploadWorksheetDialog } from "./UploadWorksheetDialog"
import { useCampus } from "@/context/CampusContext"

const WORKSHEET_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  drill: { en: "Drill", ar: "تدريب مهاري" },
  diagnostic: { en: "Diagnostic", ar: "تشخيصي" },
  remedial: { en: "Remedial", ar: "علاجي" },
  enrichment: { en: "Enrichment", ar: "إثرائي" },
  lab_sheet: { en: "Lab Sheet", ar: "ورقة مخبرية" },
  flashcards: { en: "Flashcards", ar: "بطاقات تعليمية" },
  graphic_organizer: { en: "Graphic Organizer", ar: "منظم بصري" },
  project: { en: "Project", ar: "مشروع" },
  kindergarten: { en: "Kindergarten", ar: "رياض أطفال" },
  handwriting: { en: "Handwriting", ar: "خط ويد" },
  quiz: { en: "Quiz", ar: "اختبار قصير" },
  unit_review: { en: "Unit Review", ar: "مراجعة وحدة" },
  family_activity: { en: "Family Activity", ar: "نشاط أسري" },
}

const PAGE_SIZE = 24

function WorksheetCard({
  worksheet, gradeName, subjectName, canUpload, tt, onDownload, onEdit, onDelete, onAnswerKey, campusId,
}: {
  worksheet: QirtasiWorksheet
  gradeName: string | null
  subjectName: string | null
  canUpload: boolean
  tt: (en: string, ar: string) => string
  onDownload: () => void
  onEdit: () => void
  onDelete: () => void
  onAnswerKey: () => void
  campusId?: string
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getWorksheetThumbnailUrl(worksheet.id, campusId).then((res) => {
      if (!cancelled && res.success && res.data?.url) setThumbUrl(res.data.url)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheet.id, campusId])

  const typeLabel = WORKSHEET_TYPE_LABELS[worksheet.worksheet_type]

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-gray-900">
      <div className="flex h-32 items-center justify-center bg-blue-50 dark:bg-blue-950">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={worksheet.title_ar} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-10 w-10 text-blue-300" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold" dir="rtl">{worksheet.title_ar}</h3>
        <div className="flex flex-wrap gap-1">
          {typeLabel && <Badge variant="secondary">{tt(typeLabel.en, typeLabel.ar)}</Badge>}
          {gradeName && <Badge variant="outline">{gradeName}</Badge>}
          {subjectName && <Badge variant="outline">{subjectName}</Badge>}
        </div>
        {worksheet.description && <p className="line-clamp-2 text-xs text-muted-foreground">{worksheet.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="shrink-0 text-xs text-muted-foreground">{tt(`${worksheet.download_count} downloads`, `${worksheet.download_count} تنزيل`)}</span>
          {/* Icon-only, consistent size — a text "Download" label was
              getting clipped once the 3 canUpload icons were also present,
              since a narrow card can't fit 4 buttons with text. */}
          <div className="flex shrink-0 gap-1">
            {canUpload && (
              <>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={onAnswerKey} title={tt("Answer key", "نموذج الإجابة")}>
                  <Key className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={onEdit} title={tt("Edit", "تعديل")}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={onDelete} title={tt("Delete", "حذف")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button size="icon" className="h-8 w-8" onClick={onDownload} title={tt("Download", "تنزيل")}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WorksheetLibrary({ canUpload }: { canUpload: boolean }) {
  const locale = useLocale()
  const isAr = locale === "ar"
  const tt = (en: string, ar: string) => (isAr ? ar : en)
  const tSidebar = useTranslations("sidebar")
  // Admin accounts don't get campus_id auto-resolved on req.profile the way
  // teacher/student/parent do — every Qirtasi request must carry the
  // currently-selected campus explicitly, or requireQirtasiEnabled only
  // ever checks the school-wide active_plugins row.
  const campus = useCampus()
  const campusId = campus?.selectedCampus?.id

  const [worksheets, setWorksheets] = useState<QirtasiWorksheet[]>([])
  const [grades, setGrades] = useState<CurriculumNode[]>([])
  const [subjects, setSubjects] = useState<CurriculumNode[]>([])
  // Separate from `subjects` (which is scoped to the currently-selected
  // grade filter, for the Subject dropdown) — this covers every grade's
  // subjects at once, purely so worksheet cards can show a subject name
  // badge even when no grade filter is active (the default "All grades" view).
  const [subjectNamesById, setSubjectNamesById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [count, setCount] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<QirtasiWorksheetDetail | null>(null)

  const gradeNameById = useMemo(() => Object.fromEntries(grades.map((g) => [g.id, g.name_ar])), [grades])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listWorksheets({
        grade_id: gradeFilter === "all" ? undefined : gradeFilter,
        subject_id: subjectFilter === "all" ? undefined : subjectFilter,
        worksheet_type: typeFilter === "all" ? undefined : typeFilter,
        search: search || undefined,
        campus_id: campusId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      if (!res.success) {
        toast.error(res.error || tt("Failed to load worksheets", "فشل تحميل أوراق العمل"))
        return
      }
      setWorksheets(res.data ?? [])
      setCount(res.count ?? 0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter, subjectFilter, typeFilter, search, page, campusId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    listCurriculumNodes("stages", undefined, campusId).then((stagesRes) => {
      const stageId = stagesRes.data?.[0]?.id
      if (!stageId) return
      listCurriculumNodes("grades", stageId, campusId).then(async (res) => {
        if (!res.success || !res.data) return
        setGrades(res.data)
        const subjectLists = await Promise.all(res.data.map((g) => listCurriculumNodes("subjects", g.id, campusId)))
        const names: Record<string, string> = {}
        for (const sRes of subjectLists) {
          for (const s of sRes.data ?? []) names[s.id] = s.name_ar
        }
        setSubjectNamesById(names)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId])

  useEffect(() => {
    if (gradeFilter === "all") { setSubjects([]); setSubjectFilter("all"); return }
    listCurriculumNodes("subjects", gradeFilter, campusId).then((res) => { if (res.success && res.data) setSubjects(res.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter, campusId])

  useEffect(() => {
    const id = setTimeout(() => setPage(0), 300)
    return () => clearTimeout(id)
  }, [search])

  const handleDownload = async (id: string) => {
    const res = await getWorksheetDownloadUrl(id, campusId)
    if (!res.success || !res.data) {
      toast.error(res.error || tt("Failed to get download link", "تعذر الحصول على رابط التنزيل"))
      return
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer")
  }

  const handleAnswerKey = async (id: string) => {
    const res = await getWorksheetAnswerKeyUrl(id, campusId)
    if (!res.success || !res.data?.url) {
      toast.error(res.error || tt("Answer key not available", "نموذج الإجابة غير متوفر"))
      return
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer")
  }

  const handleEdit = async (id: string) => {
    const res = await getWorksheet(id, campusId)
    if (!res.success || !res.data) {
      toast.error(res.error || tt("Failed to load worksheet", "فشل تحميل ورقة العمل"))
      return
    }
    setEditing(res.data)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(tt("Delete this worksheet?", "هل تريد حذف ورقة العمل هذه؟"))) return
    const res = await deleteWorksheet(id, campusId)
    if (!res.success) { toast.error(res.error || tt("Delete failed", "فشل الحذف")); return }
    toast.success(tt("Worksheet deleted", "تم حذف ورقة العمل"))
    load()
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-blue-900 dark:text-blue-300">
          <FileStack className="h-5 w-5" />
          {tSidebar("my_worksheet")}
        </h1>
        {canUpload && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {tt("Upload Worksheet", "رفع ورقة عمل")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={tt("Search worksheets…", "ابحث عن أوراق العمل…")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setSubjectFilter("all"); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={tt("Grade", "الصف")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All grades", "جميع الصفوف")}</SelectItem>
            {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setPage(0) }} disabled={gradeFilter === "all"}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={tt("Subject", "المادة")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All subjects", "جميع المواد")}</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0) }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={tt("Type", "النوع")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All types", "جميع الأنواع")}</SelectItem>
            {Object.entries(WORKSHEET_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{tt(label.en, label.ar)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{tt("Loading…", "جارٍ التحميل…")}</div>
      ) : worksheets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{tt("No worksheets found.", "لم يتم العثور على أوراق عمل.")}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {worksheets.map((w) => (
            <WorksheetCard
              key={w.id}
              worksheet={w}
              gradeName={gradeNameById[w.grade_id] ?? null}
              subjectName={subjectNamesById[w.subject_id] ?? null}
              canUpload={canUpload}
              tt={tt}
              onDownload={() => handleDownload(w.id)}
              onEdit={() => handleEdit(w.id)}
              onDelete={() => handleDelete(w.id)}
              onAnswerKey={() => handleAnswerKey(w.id)}
              campusId={campusId}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tt("Previous", "السابق")}</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{tt("Next", "التالي")}</Button>
        </div>
      )}

      {canUpload && (
        <UploadWorksheetDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} tt={tt} campusId={campusId} />
      )}
    </div>
  )
}
