"use client"

// Shared browse/manage view for the Qirtasi "My Worksheet" module, used by
// every role's page (admin/teacher/librarian get canUpload=true,
// student/parent get canUpload=false — server-side role checks are the real
// gate). Redesigned with category hero cards, tag chip filter bar, and a
// side filter panel inspired by worksheetfun.com.

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  FileStack, Search, Plus, Download, FileText, Pencil, Trash2, Key,
  ChevronDown, ChevronUp, SlidersHorizontal, X, Star,
  BookOpen, FlaskConical, Layers, Lightbulb, Brain, PenLine,
  Baby, ClipboardCheck, Home, BarChart2, LayoutGrid,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  listWorksheets, deleteWorksheet, getWorksheetDownloadUrl, getWorksheetThumbnailUrl,
  getWorksheetAnswerKeyUrl, getWorksheet, type QirtasiWorksheet, type QirtasiWorksheetDetail,
} from "@/lib/api/worksheets"
import { listCurriculumNodes, type CurriculumNode } from "@/lib/api/qirtasi-curriculum"
import { listFacets, type Facet } from "@/lib/api/qirtasi-facets"
import { UploadWorksheetDialog } from "./UploadWorksheetDialog"
import { useCampus } from "@/context/CampusContext"

// ─── Type category config ────────────────────────────────────────────────────

const WORKSHEET_TYPES: {
  value: string; en: string; ar: string
  icon: React.ElementType; color: string; bg: string
}[] = [
  { value: "drill",             en: "Drill",             ar: "تدريب مهاري",    icon: BarChart2,      color: "text-blue-700",   bg: "bg-blue-50 hover:bg-blue-100 border-blue-200" },
  { value: "enrichment",        en: "Enrichment",        ar: "إثرائي",         icon: Lightbulb,      color: "text-amber-700",  bg: "bg-amber-50 hover:bg-amber-100 border-amber-200" },
  { value: "diagnostic",        en: "Diagnostic",        ar: "تشخيصي",         icon: FlaskConical,   color: "text-purple-700", bg: "bg-purple-50 hover:bg-purple-100 border-purple-200" },
  { value: "remedial",          en: "Remedial",          ar: "علاجي",          icon: BookOpen,       color: "text-green-700",  bg: "bg-green-50 hover:bg-green-100 border-green-200" },
  { value: "lab_sheet",         en: "Lab Sheet",         ar: "ورقة مخبرية",    icon: FlaskConical,   color: "text-cyan-700",   bg: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200" },
  { value: "flashcards",        en: "Flashcards",        ar: "بطاقات تعليمية", icon: Layers,         color: "text-rose-700",   bg: "bg-rose-50 hover:bg-rose-100 border-rose-200" },
  { value: "graphic_organizer", en: "Graphic Organizer", ar: "منظم بصري",      icon: LayoutGrid,     color: "text-indigo-700", bg: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200" },
  { value: "project",           en: "Project",           ar: "مشروع",          icon: Brain,          color: "text-orange-700", bg: "bg-orange-50 hover:bg-orange-100 border-orange-200" },
  { value: "kindergarten",      en: "Kindergarten",      ar: "رياض أطفال",     icon: Baby,           color: "text-pink-700",   bg: "bg-pink-50 hover:bg-pink-100 border-pink-200" },
  { value: "handwriting",       en: "Handwriting",       ar: "خط ويد",         icon: PenLine,        color: "text-teal-700",   bg: "bg-teal-50 hover:bg-teal-100 border-teal-200" },
  { value: "quiz",              en: "Quiz",              ar: "اختبار قصير",    icon: ClipboardCheck, color: "text-violet-700", bg: "bg-violet-50 hover:bg-violet-100 border-violet-200" },
  { value: "unit_review",       en: "Unit Review",       ar: "مراجعة وحدة",    icon: BookOpen,       color: "text-sky-700",    bg: "bg-sky-50 hover:bg-sky-100 border-sky-200" },
  { value: "family_activity",   en: "Family Activity",   ar: "نشاط أسري",      icon: Home,           color: "text-lime-700",   bg: "bg-lime-50 hover:bg-lime-100 border-lime-200" },
]

const TYPE_MAP = Object.fromEntries(WORKSHEET_TYPES.map((t) => [t.value, t]))
const PAGE_SIZE = 24
const CHIP_FACET_KEYS = ["purpose", "blooms_level", "difficulty", "grouping", "duration_minutes", "print_mode", "accessibility"]

// ─── Worksheet card ───────────────────────────────────────────────────────────

function WorksheetCard({
  worksheet, gradeName, subjectName, canUpload, tt, onDownload, onEdit, onDelete, onAnswerKey, campusId,
}: {
  worksheet: QirtasiWorksheet; gradeName: string | null; subjectName: string | null
  canUpload: boolean; tt: (en: string, ar: string) => string
  onDownload: () => void; onEdit: () => void; onDelete: () => void; onAnswerKey: () => void
  campusId?: string
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const typeInfo = TYPE_MAP[worksheet.worksheet_type]

  useEffect(() => {
    let cancelled = false
    getWorksheetThumbnailUrl(worksheet.id, campusId).then((res) => {
      if (!cancelled && res.success && res.data?.url) setThumbUrl(res.data.url)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheet.id, campusId])

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-900">
      {/* A4 Portrait preview container (exact 210x297 A4 ratio) */}
      <div className={cn("relative flex aspect-[210/297] w-full items-center justify-center overflow-hidden p-3", typeInfo ? typeInfo.bg : "bg-slate-100 dark:bg-slate-800")}>
        {/* Paper sheet frame */}
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-sm border border-slate-200/80 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={worksheet.title_ar}
              className="h-full w-full object-contain p-1 transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-400">
              {typeInfo
                ? <typeInfo.icon className={cn("h-14 w-14 opacity-50", typeInfo.color)} />
                : <FileText className="h-14 w-14 text-blue-300" />
              }
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">A4 Worksheet</span>
            </div>
          )}
        </div>
        {typeInfo && (
          <span className={cn("absolute right-4 top-4 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shadow-xs z-10", typeInfo.bg, typeInfo.color)}>
            {tt(typeInfo.en, typeInfo.ar)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug" dir="rtl">{worksheet.title_ar}</h3>
        <div className="flex flex-wrap gap-1">
          {gradeName && <Badge variant="outline" className="text-[10px]">{gradeName}</Badge>}
          {subjectName && <Badge variant="outline" className="text-[10px]">{subjectName}</Badge>}
        </div>
        {worksheet.description && <p className="line-clamp-2 text-[11px] text-muted-foreground">{worksheet.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-1 pt-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{worksheet.download_count}</span>
            {worksheet.rating_avg > 0 && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Star className="h-3 w-3 fill-amber-400" />{worksheet.rating_avg.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {canUpload && (
              <>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={onAnswerKey} title={tt("Answer key", "نموذج الإجابة")}>
                  <Key className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={onEdit} title={tt("Edit", "تعديل")}>
                  <Pencil className="h-3 w-3" />
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

// ─── Type hero cards ──────────────────────────────────────────────────────────

function TypeHeroCards({ typeFilter, onSelect, tt }: {
  typeFilter: string; onSelect: (v: string) => void; tt: (en: string, ar: string) => string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-center transition-all",
          typeFilter === "all"
            ? "border-[#022172] bg-[#022172] text-white shadow-md"
            : "border-gray-200 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
        )}
      >
        <LayoutGrid className={cn("h-6 w-6", typeFilter === "all" ? "text-white" : "text-gray-500")} />
        <span className="text-[11px] font-semibold whitespace-nowrap">{tt("All Types", "جميع الأنواع")}</span>
      </button>
      {WORKSHEET_TYPES.map((t) => {
        const Icon = t.icon
        const active = typeFilter === t.value
        return (
          <button
            key={t.value}
            onClick={() => onSelect(active ? "all" : t.value)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-center transition-all",
              active ? "border-[#022172] bg-[#022172] text-white shadow-md" : cn("bg-white dark:bg-gray-900 dark:border-gray-700", t.bg)
            )}
          >
            <Icon className={cn("h-6 w-6", active ? "text-white" : t.color)} />
            <span className={cn("text-[11px] font-semibold whitespace-nowrap", active ? "text-white" : t.color)}>
              {tt(t.en, t.ar)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Tag chip strip ───────────────────────────────────────────────────────────

function TagChipStrip({ facets, selectedIds, onToggle, tt }: {
  facets: Facet[]; selectedIds: Set<string>; onToggle: (id: string) => void; tt: (en: string, ar: string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const chipFacets = facets.filter((f) => CHIP_FACET_KEYS.includes(f.key))
  if (chipFacets.length === 0) return null
  const allValues = chipFacets.flatMap((f) => f.values)
  const visible = expanded ? allValues : allValues.slice(0, 16)
  return (
    <div className="rounded-lg border bg-white p-3 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{tt("Filter by Tags", "تصفية بالوسوم")}</span>
        {selectedIds.size > 0 && (
          <button onClick={() => allValues.forEach((v) => { if (selectedIds.has(v.id)) onToggle(v.id) })}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700">
            <X className="h-3 w-3" />{tt("Clear", "مسح")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((v) => (
          <button key={v.id} onClick={() => onToggle(v.id)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              selectedIds.has(v.id) ? "border-[#022172] bg-[#022172] text-white" : "border-input hover:bg-accent"
            )}>
            {v.label_ar}
          </button>
        ))}
      </div>
      {allValues.length > 16 && (
        <button onClick={() => setExpanded((e) => !e)}
          className="mt-2 flex items-center gap-1 text-[11px] text-[#57A3CC] hover:underline">
          {expanded
            ? <><ChevronUp className="h-3 w-3" />{tt("Show less", "عرض أقل")}</>
            : <><ChevronDown className="h-3 w-3" />{tt("Show more", `عرض المزيد (${allValues.length - 16}+)`)}</>}
        </button>
      )}
    </div>
  )
}

// ─── Filter panel (used in desktop sidebar & mobile sheet) ───────────────────

function FilterPanel({
  grades, subjects, facets, gradeFilter, subjectFilter, typeFilter, selectedFacetIds,
  onGradeChange, onSubjectChange, onTypeChange, onFacetToggle, tt,
}: {
  grades: CurriculumNode[]; subjects: CurriculumNode[]; facets: Facet[]
  gradeFilter: string; subjectFilter: string; typeFilter: string; selectedFacetIds: Set<string>
  onGradeChange: (v: string) => void; onSubjectChange: (v: string) => void; onTypeChange: (v: string) => void
  onFacetToggle: (id: string) => void; tt: (en: string, ar: string) => string
}) {
  const chipFacets = facets.filter((f) => CHIP_FACET_KEYS.includes(f.key))
  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{tt("Grade", "الصف")}</label>
        <Select value={gradeFilter} onValueChange={(v) => { onGradeChange(v); onSubjectChange("all") }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All grades", "جميع الصفوف")}</SelectItem>
            {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{tt("Subject", "المادة")}</label>
        <Select value={subjectFilter} onValueChange={onSubjectChange} disabled={gradeFilter === "all"}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All subjects", "جميع المواد")}</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">{tt("Type", "النوع")}</label>
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tt("All types", "جميع الأنواع")}</SelectItem>
            {WORKSHEET_TYPES.map((w) => <SelectItem key={w.value} value={w.value}>{tt(w.en, w.ar)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {chipFacets.map((f) => (
        <div key={f.id} className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">{f.name_ar}</label>
          <div className="flex flex-wrap gap-1">
            {f.values.map((v) => (
              <button key={v.id} onClick={() => onFacetToggle(v.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  selectedFacetIds.has(v.id) ? "border-[#022172] bg-[#022172] text-white" : "border-input hover:bg-accent"
                )}>
                {v.label_ar}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Active filter pills ──────────────────────────────────────────────────────

function ActiveFilterPills({ typeFilter, gradeFilter, subjectFilter, selectedFacetIds, gradeName, subjectName, facets, onClearType, onClearGrade, onClearSubject, onClearFacet, onClearAll, tt }: {
  typeFilter: string; gradeFilter: string; subjectFilter: string; selectedFacetIds: Set<string>
  gradeName: string; subjectName: string; facets: Facet[]
  onClearType: () => void; onClearGrade: () => void; onClearSubject: () => void
  onClearFacet: (id: string) => void; onClearAll: () => void; tt: (en: string, ar: string) => string
}) {
  const hasAny = typeFilter !== "all" || gradeFilter !== "all" || subjectFilter !== "all" || selectedFacetIds.size > 0
  if (!hasAny) return null
  const allFacetValues = facets.flatMap((f) => f.values)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{tt("Active filters:", "الفلاتر النشطة:")}</span>
      {typeFilter !== "all" && (
        <span className="flex items-center gap-1 rounded-full bg-[#022172] px-2.5 py-0.5 text-[11px] text-white">
          {tt(TYPE_MAP[typeFilter]?.en ?? typeFilter, TYPE_MAP[typeFilter]?.ar ?? typeFilter)}
          <button onClick={onClearType}><X className="h-3 w-3" /></button>
        </span>
      )}
      {gradeFilter !== "all" && (
        <span className="flex items-center gap-1 rounded-full bg-[#022172] px-2.5 py-0.5 text-[11px] text-white">
          {gradeName}<button onClick={onClearGrade}><X className="h-3 w-3" /></button>
        </span>
      )}
      {subjectFilter !== "all" && (
        <span className="flex items-center gap-1 rounded-full bg-[#022172] px-2.5 py-0.5 text-[11px] text-white">
          {subjectName}<button onClick={onClearSubject}><X className="h-3 w-3" /></button>
        </span>
      )}
      {[...selectedFacetIds].map((id) => {
        const v = allFacetValues.find((fv) => fv.id === id)
        return v ? (
          <span key={id} className="flex items-center gap-1 rounded-full bg-[#57A3CC] px-2.5 py-0.5 text-[11px] text-white">
            {v.label_ar}<button onClick={() => onClearFacet(id)}><X className="h-3 w-3" /></button>
          </span>
        ) : null
      })}
      <button onClick={onClearAll} className="text-[11px] text-red-500 hover:underline">{tt("Clear all", "مسح الكل")}</button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Data
  const [worksheets, setWorksheets] = useState<QirtasiWorksheet[]>([])
  const [grades, setGrades] = useState<CurriculumNode[]>([])
  const [subjects, setSubjects] = useState<CurriculumNode[]>([])
  const [subjectNamesById, setSubjectNamesById] = useState<Record<string, string>>({})
  const [facets, setFacets] = useState<Facet[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedFacetIds, setSelectedFacetIds] = useState<Set<string>>(new Set())

  // Dialog
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
        facet_value_ids: selectedFacetIds.size > 0 ? [...selectedFacetIds] : undefined,
        search: search || undefined,
        campus_id: campusId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      if (!res.success) { toast.error(res.error || tt("Failed to load worksheets", "فشل تحميل أوراق العمل")); return }
      setWorksheets(res.data ?? [])
      setCount(res.count ?? 0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeFilter, subjectFilter, typeFilter, selectedFacetIds, search, page, campusId])

  useEffect(() => { load() }, [load])

  // Load grades + all subjects for badge labels
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
    listFacets(campusId).then((res) => { if (res.success && res.data) setFacets(res.data) })
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

  const toggleFacet = (id: string) => {
    setSelectedFacetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setPage(0)
  }

  const handleDownload = async (id: string) => {
    const res = await getWorksheetDownloadUrl(id, campusId)
    if (!res.success || !res.data) { toast.error(res.error || tt("Failed to get download link", "تعذر الحصول على رابط التنزيل")); return }
    window.open(res.data.url, "_blank", "noopener,noreferrer")
  }

  const handleAnswerKey = async (id: string) => {
    const res = await getWorksheetAnswerKeyUrl(id, campusId)
    if (!res.success || !res.data?.url) { toast.error(res.error || tt("Answer key not available", "نموذج الإجابة غير متوفر")); return }
    window.open(res.data.url, "_blank", "noopener,noreferrer")
  }

  const handleEdit = async (id: string) => {
    const res = await getWorksheet(id, campusId)
    if (!res.success || !res.data) { toast.error(res.error || tt("Failed to load worksheet", "فشل تحميل ورقة العمل")); return }
    setEditing(res.data); setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(tt("Delete this worksheet?", "هل تريد حذف ورقة العمل هذه؟"))) return
    const res = await deleteWorksheet(id, campusId)
    if (!res.success) { toast.error(res.error || tt("Delete failed", "فشل الحذف")); return }
    toast.success(tt("Worksheet deleted", "تم حذف ورقة العمل"))
    load()
  }

  const clearAll = () => {
    setGradeFilter("all"); setSubjectFilter("all"); setTypeFilter("all")
    setSelectedFacetIds(new Set()); setSearch(""); setPage(0)
  }

  const activeFilterCount = [gradeFilter !== "all", subjectFilter !== "all", typeFilter !== "all"].filter(Boolean).length + selectedFacetIds.size
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[#022172] dark:text-blue-300">
            <FileStack className="h-6 w-6" />
            {tSidebar("my_worksheet")} — قرطاسي
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tt("Browse and manage educational worksheets", "تصفح وإدارة أوراق العمل التعليمية")}
          </p>
        </div>
        {canUpload && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-1.5 bg-[#022172] hover:bg-[#033299]">
            <Plus className="h-4 w-4" />{tt("Upload Worksheet", "رفع ورقة عمل")}
          </Button>
        )}
      </div>

      {/* Category hero cards */}
      <TypeHeroCards typeFilter={typeFilter} onSelect={(v) => { setTypeFilter(v); setPage(0) }} tt={tt} />

      {/* Search bar + mobile filter sheet trigger */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tt("Search worksheets…", "ابحث عن أوراق العمل…")}
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-1.5 lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              {tt("Filters", "الفلاتر")}
              {activeFilterCount > 0 && (
                <Badge className="h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">{activeFilterCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader><SheetTitle>{tt("Filters", "الفلاتر")}</SheetTitle></SheetHeader>
            <div className="mt-4">
              <FilterPanel
                grades={grades} subjects={subjects} facets={facets}
                gradeFilter={gradeFilter} subjectFilter={subjectFilter} typeFilter={typeFilter}
                selectedFacetIds={selectedFacetIds}
                onGradeChange={(v) => { setGradeFilter(v); setPage(0) }}
                onSubjectChange={(v) => { setSubjectFilter(v); setPage(0) }}
                onTypeChange={(v) => { setTypeFilter(v); setPage(0) }}
                onFacetToggle={toggleFacet} tt={tt}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Tag chip strip */}
      <TagChipStrip facets={facets} selectedIds={selectedFacetIds} onToggle={toggleFacet} tt={tt} />

      {/* Active filter pills */}
      <ActiveFilterPills
        typeFilter={typeFilter} gradeFilter={gradeFilter} subjectFilter={subjectFilter}
        selectedFacetIds={selectedFacetIds}
        gradeName={gradeNameById[gradeFilter] ?? ""} subjectName={subjectNamesById[subjectFilter] ?? ""}
        facets={facets}
        onClearType={() => { setTypeFilter("all"); setPage(0) }}
        onClearGrade={() => { setGradeFilter("all"); setSubjectFilter("all"); setPage(0) }}
        onClearSubject={() => { setSubjectFilter("all"); setPage(0) }}
        onClearFacet={toggleFacet} onClearAll={clearAll} tt={tt}
      />

      {/* Main layout: sticky desktop side panel + grid */}
      <div className="flex gap-5">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 rounded-xl border bg-white p-4 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{tt("Filters", "الفلاتر")}</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-[11px] text-red-500 hover:underline">{tt("Clear all", "مسح الكل")}</button>
              )}
            </div>
            <FilterPanel
              grades={grades} subjects={subjects} facets={facets}
              gradeFilter={gradeFilter} subjectFilter={subjectFilter} typeFilter={typeFilter}
              selectedFacetIds={selectedFacetIds}
              onGradeChange={(v) => { setGradeFilter(v); setPage(0) }}
              onSubjectChange={(v) => { setSubjectFilter(v); setPage(0) }}
              onTypeChange={(v) => { setTypeFilter(v); setPage(0) }}
              onFacetToggle={toggleFacet} tt={tt}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {!loading && (
            <p className="mb-3 text-xs text-muted-foreground">
              {tt(`${count} worksheets found`, `${count} ورقة عمل`)}
            </p>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl border bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : worksheets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-white py-16 text-center dark:bg-gray-900">
              <FileStack className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-muted-foreground">{tt("No worksheets found.", "لم يتم العثور على أوراق عمل.")}</p>
              {canUpload && (
                <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-1.5">
                  <Plus className="h-4 w-4" />{tt("Upload your first worksheet", "ارفع ورقة عملك الأولى")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {worksheets.map((w) => (
                <WorksheetCard
                  key={w.id} worksheet={w}
                  gradeName={gradeNameById[w.grade_id] ?? null}
                  subjectName={subjectNamesById[w.subject_id] ?? null}
                  canUpload={canUpload} tt={tt}
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
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{tt("Previous", "السابق")}</Button>
              <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{tt("Next", "التالي")}</Button>
            </div>
          )}
        </div>
      </div>

      {canUpload && (
        <UploadWorksheetDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} tt={tt} campusId={campusId} />
      )}
    </div>
  )
}
