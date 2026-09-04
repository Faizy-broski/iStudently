"use client"

// Admin curriculum-tree management UI — the tool for entering real
// curriculum data over time (no such data source exists yet, see the plan).
// A Finder-style drill-down: Stage (read-only, fixed 5 values) -> Grade ->
// Subject -> Unit -> Lesson, each column scoped to the parent selected in
// the column before it. Track is folded into the Grade column's detail
// (secondary-stage only) rather than its own column, to keep this
// tractable — most schools only need the Grade->Subject->Unit->Lesson path.

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ChevronRight, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  listCurriculumNodes, createCurriculumNode, updateCurriculumNode, deleteCurriculumNode,
  type CurriculumLevel, type CurriculumNode,
} from "@/lib/api/qirtasi-curriculum"
import { useCampus } from "@/context/CampusContext"

function useTt() {
  const locale = useLocale()
  const isAr = locale === "ar"
  return (en: string, ar: string) => (isAr ? ar : en)
}

function nodeLabel(node: CurriculumNode, isAr: boolean): string {
  return (isAr ? node.name_ar : node.name_en) || node.name_ar
}

// qirtasi_education_stages.key is CHECK-constrained to exactly these 5
// values (migration 281) — stages aren't free-text like every other level,
// so their "code" field renders as a fixed dropdown and submits as `key`.
const STAGE_KEY_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "kindergarten", ar: "روضة", en: "Kindergarten" },
  { value: "basic", ar: "أساسي", en: "Basic" },
  { value: "secondary", ar: "ثانوي", en: "Secondary" },
  { value: "university", ar: "جامعي", en: "University" },
  { value: "vocational", ar: "مهني", en: "Vocational" },
]

interface ColumnProps {
  level: CurriculumLevel
  parentId?: string
  parentField?: string // extra field to attach to create payload (e.g. stage_id)
  selectedId: string | null
  onSelect: (node: CurriculumNode) => void
  title: string
  requiresParent?: boolean
  fixedKeyOptions?: { value: string; ar: string; en: string }[] // stages only
  campusId?: string
}

function CurriculumColumn({ level, parentId, parentField, selectedId, onSelect, title, requiresParent, fixedKeyOptions, campusId }: ColumnProps) {
  const tt = useTt()
  const locale = useLocale()
  const isAr = locale === "ar"
  const [nodes, setNodes] = useState<CurriculumNode[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<CurriculumNode | null>(null)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [nameEn, setNameEn] = useState("")

  const load = () => {
    if (requiresParent && !parentId) { setNodes([]); return }
    setLoading(true)
    listCurriculumNodes(level, parentId, campusId).then((res) => {
      if (res.success && res.data) setNodes(res.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [level, parentId, campusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => { setCode(""); setNameAr(""); setNameEn(""); setEditing(null); setAdding(false) }

  const startEdit = (node: CurriculumNode) => {
    setEditing(node); setAdding(false)
    setCode(node.code ?? node.key ?? ""); setNameAr(node.name_ar); setNameEn(node.name_en ?? "")
  }

  const handleSave = async () => {
    if (!nameAr.trim()) { toast.error(tt("Arabic name is required", "الاسم بالعربية مطلوب")); return }
    if (fixedKeyOptions && !code) { toast.error(tt("Pick a stage", "اختر مرحلة")); return }
    const payload: Record<string, unknown> = { name_ar: nameAr, name_en: nameEn || undefined }
    if (fixedKeyOptions) payload.key = code // qirtasi_education_stages uses `key`, not `code`
    else if (level !== "outcomes") payload.code = code
    if (parentField && parentId) payload[parentField] = parentId

    if (editing) {
      const res = await updateCurriculumNode(level, editing.id, payload, campusId)
      if (!res.success) { toast.error(res.error || tt("Update failed", "فشل التحديث")); return }
    } else {
      const res = await createCurriculumNode(level, payload, campusId)
      if (!res.success) { toast.error(res.error || tt("Create failed", "فشل الإنشاء")); return }
    }
    resetForm()
    load()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(tt("Delete this and everything under it?", "هل تريد حذف هذا العنصر وكل ما تحته؟"))) return
    const res = await deleteCurriculumNode(level, id, campusId)
    if (!res.success) { toast.error(res.error || tt("Delete failed", "فشل الحذف")); return }
    load()
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-bold uppercase text-muted-foreground">{title}</h3>
        {(!requiresParent || parentId) && (
          <button onClick={() => { setAdding(true); setEditing(null); setCode(""); setNameAr(""); setNameEn("") }} className="rounded p-1 hover:bg-accent">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {(adding || editing) && (
        <div className="space-y-1.5 border-b bg-blue-50 p-2 dark:bg-blue-950">
          {fixedKeyOptions ? (
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">{tt("Select stage…", "اختر مرحلة…")}</option>
              {fixedKeyOptions.map((o) => <option key={o.value} value={o.value}>{tt(o.en, o.ar)}</option>)}
            </select>
          ) : level !== "outcomes" ? (
            <Input placeholder={tt("Code", "الرمز")} value={code} onChange={(e) => setCode(e.target.value)} className="h-7 text-xs" />
          ) : null}
          <Input placeholder={tt("Name (Arabic)", "الاسم بالعربية")} value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="h-7 text-xs" dir="rtl" />
          <Input placeholder={tt("Name (English, optional)", "الاسم بالإنجليزية (اختياري)")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-7 text-xs" />
          <div className="flex gap-1">
            <Button size="sm" className="h-6 flex-1 text-xs" onClick={handleSave}>{tt("Save", "حفظ")}</Button>
            <Button size="sm" variant="outline" className="h-6 flex-1 text-xs" onClick={resetForm}>{tt("Cancel", "إلغاء")}</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {requiresParent && !parentId ? (
          <div className="p-3 text-xs text-muted-foreground">{tt("Select an item to the left first.", "اختر عنصرًا من اليسار أولاً.")}</div>
        ) : loading ? (
          <div className="p-3 text-xs text-muted-foreground">{tt("Loading…", "جارٍ التحميل…")}</div>
        ) : nodes.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">{tt("Nothing here yet.", "لا يوجد شيء هنا بعد.")}</div>
        ) : (
          nodes.map((n) => (
            <div
              key={n.id}
              onClick={() => onSelect(n)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-1 border-b px-3 py-2 text-sm hover:bg-accent",
                selectedId === n.id && "bg-blue-100 dark:bg-blue-900"
              )}
            >
              <span className="truncate">{nodeLabel(n, isAr)}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); startEdit(n) }} className="rounded p-0.5 hover:bg-white/50">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }} className="rounded p-0.5 text-red-600 hover:bg-white/50">
                  <Trash2 className="h-3 w-3" />
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function CurriculumManager() {
  const tt = useTt()
  // Admin accounts don't get campus_id auto-resolved on req.profile —
  // every Qirtasi request must carry the currently-selected campus
  // explicitly, or requireQirtasiEnabled only checks the school-wide row.
  const campus = useCampus()
  const campusId = campus?.selectedCampus?.id
  const [stage, setStage] = useState<CurriculumNode | null>(null)
  const [grade, setGrade] = useState<CurriculumNode | null>(null)
  const [subject, setSubject] = useState<CurriculumNode | null>(null)
  const [unit, setUnit] = useState<CurriculumNode | null>(null)

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="flex items-center gap-2 text-lg font-bold text-blue-900 dark:text-blue-300">
        <GraduationCap className="h-5 w-5" />
        {tt("Curriculum Manager", "إدارة المنهج")}
      </h1>
      <p className="text-xs text-muted-foreground">
        {tt(
          "Build the shared curriculum reference tree that worksheets are categorized against. No real curriculum data is pre-loaded — enter it here as it becomes available.",
          "أنشئ شجرة المنهج المرجعية المشتركة التي تُصنَّف أوراق العمل بناءً عليها. لا توجد بيانات منهج حقيقية محمّلة مسبقًا — أدخلها هنا كلما توفرت."
        )}
      </p>

      <div className="flex overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
        <CurriculumColumn
          level="stages"
          selectedId={stage?.id ?? null}
          onSelect={(n) => { setStage(n); setGrade(null); setSubject(null); setUnit(null) }}
          title={tt("Education Stage", "المرحلة")}
          fixedKeyOptions={STAGE_KEY_OPTIONS}
          campusId={campusId}
        />
        <CurriculumColumn
          level="grades"
          parentId={stage?.id}
          parentField="stage_id"
          requiresParent
          selectedId={grade?.id ?? null}
          onSelect={(n) => { setGrade(n); setSubject(null); setUnit(null) }}
          title={tt("Grade", "الصف")}
          campusId={campusId}
        />
        <CurriculumColumn
          level="subjects"
          parentId={grade?.id}
          parentField="grade_id"
          requiresParent
          selectedId={subject?.id ?? null}
          onSelect={(n) => { setSubject(n); setUnit(null) }}
          title={tt("Subject", "المادة")}
          campusId={campusId}
        />
        <CurriculumColumn
          level="units"
          parentId={subject?.id}
          parentField="subject_id"
          requiresParent
          selectedId={unit?.id ?? null}
          onSelect={(n) => setUnit(n)}
          title={tt("Unit", "الوحدة")}
          campusId={campusId}
        />
        <CurriculumColumn
          level="lessons"
          parentId={unit?.id}
          parentField="unit_id"
          requiresParent
          selectedId={null}
          onSelect={() => {}}
          title={tt("Lesson", "الدرس")}
          campusId={campusId}
        />
      </div>
    </div>
  )
}
