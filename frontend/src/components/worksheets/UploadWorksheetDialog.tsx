"use client"

// Upload/edit form for a single Qirtasi worksheet — cascading curriculum
// selects (grade -> subject -> term -> unit -> lesson) plus pedagogical/
// practical facet tagging, replacing the old free-text subject field. The
// dropzone is a bespoke inline implementation (drag/drop, preview, remove)
// adapted from admin/library/UploadDocumentDialog.tsx's pattern — no
// generic reusable dropzone exists yet in this codebase for real (non-
// base64) file uploads.

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { UploadCloud, X, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { uploadWorksheet, updateWorksheet, type QirtasiWorksheetDetail } from "@/lib/api/worksheets"
import { listCurriculumNodes, type CurriculumNode } from "@/lib/api/qirtasi-curriculum"
import { listFacets, type Facet } from "@/lib/api/qirtasi-facets"

const WORKSHEET_TYPES: { value: string; en: string; ar: string }[] = [
  { value: "drill", en: "Drill", ar: "تدريب مهاري" },
  { value: "diagnostic", en: "Diagnostic", ar: "تشخيصي" },
  { value: "remedial", en: "Remedial", ar: "علاجي" },
  { value: "enrichment", en: "Enrichment", ar: "إثرائي" },
  { value: "lab_sheet", en: "Lab Sheet", ar: "ورقة مخبرية" },
  { value: "flashcards", en: "Flashcards", ar: "بطاقات تعليمية" },
  { value: "graphic_organizer", en: "Graphic Organizer", ar: "منظم بصري" },
  { value: "project", en: "Project", ar: "مشروع" },
  { value: "kindergarten", en: "Kindergarten", ar: "رياض أطفال" },
  { value: "handwriting", en: "Handwriting", ar: "خط ويد" },
  { value: "quiz", en: "Quiz", ar: "اختبار قصير" },
  { value: "unit_review", en: "Unit Review", ar: "مراجعة وحدة" },
  { value: "family_activity", en: "Family Activity", ar: "نشاط أسري" },
]

const MAX_FILE_MB = 25
// Only these facet groups/types render as pickable chips here — reference-
// type facets (grade/subject/unit/lesson/...) are the dedicated cascading
// selects below, and bool-type facets (has_answer_key/is_editable/
// offline_available) aren't part of this slice's tagging UI.
const CHIP_FACET_KEYS = ["purpose", "blooms_level", "difficulty", "grouping", "duration_minutes", "print_mode", "accessibility", "approval_state"]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: QirtasiWorksheetDetail | null
  onSaved: () => void
  tt: (en: string, ar: string) => string
  campusId?: string
}

function DropField({
  label, accept, file, onFile, hint,
}: { label: string; accept: string; file: File | null; onFile: (f: File | null) => void; hint?: string }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm transition-colors",
          dragging ? "border-blue-500 bg-blue-50" : "border-input hover:bg-accent"
        )}
      >
        {file ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="truncate">{file.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <UploadCloud className="h-4 w-4" />
            <span>{hint}</span>
          </div>
        )}
        {file && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onFile(null) }} className="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </div>
    </div>
  )
}

export function UploadWorksheetDialog({ open, onOpenChange, editing, onSaved, tt, campusId }: Props) {
  const [grades, setGrades] = useState<CurriculumNode[]>([])
  const [subjects, setSubjects] = useState<CurriculumNode[]>([])
  const [terms, setTerms] = useState<CurriculumNode[]>([])
  const [units, setUnits] = useState<CurriculumNode[]>([])
  const [lessons, setLessons] = useState<CurriculumNode[]>([])
  const [facets, setFacets] = useState<Facet[]>([])

  const [titleAr, setTitleAr] = useState("")
  const [titleEn, setTitleEn] = useState("")
  const [description, setDescription] = useState("")
  const [worksheetType, setWorksheetType] = useState("drill")
  const [gradeId, setGradeId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [termId, setTermId] = useState<string>("none")
  const [unitId, setUnitId] = useState<string>("none")
  const [lessonId, setLessonId] = useState<string>("none")
  const [visibilityScope, setVisibilityScope] = useState<"private" | "school" | "public">("school")
  const [selectedFacetValueIds, setSelectedFacetValueIds] = useState<Set<string>>(new Set())
  const [file, setFile] = useState<File | null>(null)
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [answerKey, setAnswerKey] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // All grades under the (only, for this slice) "basic" stage are loaded
  // flat, since this foundation slice seeds one stage — a stage picker can
  // be added once secondary/tracks data exists.
  useEffect(() => {
    if (!open) return
    listCurriculumNodes("stages", undefined, campusId).then((stagesRes) => {
      const stageId = stagesRes.data?.[0]?.id
      if (stageId) listCurriculumNodes("grades", stageId, campusId).then((res) => { if (res.success && res.data) setGrades(res.data) })
    })
    listCurriculumNodes("terms", undefined, campusId).then((res) => { if (res.success && res.data) setTerms(res.data) })
    listFacets(campusId).then((res) => { if (res.success && res.data) setFacets(res.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campusId])

  useEffect(() => {
    if (!gradeId) { setSubjects([]); return }
    listCurriculumNodes("subjects", gradeId, campusId).then((res) => { if (res.success && res.data) setSubjects(res.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, campusId])

  useEffect(() => {
    if (!subjectId) { setUnits([]); return }
    listCurriculumNodes("units", subjectId, campusId).then((res) => { if (res.success && res.data) setUnits(res.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, campusId])

  useEffect(() => {
    if (!unitId || unitId === "none") { setLessons([]); return }
    listCurriculumNodes("lessons", unitId, campusId).then((res) => { if (res.success && res.data) setLessons(res.data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, campusId])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitleAr(editing.title_ar); setTitleEn(editing.title_en ?? ""); setDescription(editing.description ?? "")
      setWorksheetType(editing.worksheet_type); setGradeId(editing.grade_id); setSubjectId(editing.subject_id)
      setTermId(editing.term_id ?? "none"); setUnitId(editing.unit_id ?? "none"); setLessonId(editing.lesson_id ?? "none")
      setVisibilityScope(editing.visibility_scope === "marketplace" ? "school" : editing.visibility_scope)
      setSelectedFacetValueIds(new Set((editing.facet_values ?? []).map((fv) => fv.facet_value_id)))
    } else {
      setTitleAr(""); setTitleEn(""); setDescription(""); setWorksheetType("drill")
      setGradeId(""); setSubjectId(""); setTermId("none"); setUnitId("none"); setLessonId("none")
      setVisibilityScope("school"); setSelectedFacetValueIds(new Set())
    }
    setFile(null); setThumbnail(null); setAnswerKey(null)
  }, [open, editing])

  const toggleFacetValue = (id: string) => {
    setSelectedFacetValueIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    if (!titleAr.trim()) { toast.error(tt("Arabic title is required", "العنوان بالعربية مطلوب")); return }
    if (!gradeId || !subjectId) { toast.error(tt("Grade and subject are required", "الصف والمادة مطلوبان")); return }
    if (!editing && !file) { toast.error(tt("Please attach a worksheet file", "يرجى إرفاق ملف ورقة العمل")); return }
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(tt(`File must be under ${MAX_FILE_MB}MB`, `يجب ألا يتجاوز حجم الملف ${MAX_FILE_MB} ميغابايت`))
      return
    }

    const facetValueIds = [...selectedFacetValueIds]
    setSaving(true)
    try {
      if (editing) {
        const res = await updateWorksheet(editing.id, {
          title_ar: titleAr, title_en: titleEn || undefined, description: description || undefined,
          worksheet_type: worksheetType, grade_id: gradeId, subject_id: subjectId,
          term_id: termId === "none" ? null : termId, unit_id: unitId === "none" ? null : unitId, lesson_id: lessonId === "none" ? null : lessonId,
          visibility_scope: visibilityScope, facet_value_ids: facetValueIds,
        }, campusId)
        if (!res.success) { toast.error(res.error || tt("Update failed", "فشل التحديث")); return }
        toast.success(tt("Worksheet updated", "تم تحديث ورقة العمل"))
      } else {
        const res = await uploadWorksheet({
          title_ar: titleAr, title_en: titleEn || undefined, description: description || undefined,
          worksheet_type: worksheetType, grade_id: gradeId, subject_id: subjectId,
          term_id: termId === "none" ? null : termId, unit_id: unitId === "none" ? null : unitId, lesson_id: lessonId === "none" ? null : lessonId,
          visibility_scope: visibilityScope, facet_value_ids: facetValueIds,
          file: file as File, thumbnail, answerKey,
        }, campusId)
        if (!res.success) { toast.error(res.error || tt("Upload failed", "فشل الرفع")); return }
        toast.success(tt("Worksheet uploaded", "تم رفع ورقة العمل"))
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const chipFacets = facets.filter((f) => CHIP_FACET_KEYS.includes(f.key))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? tt("Edit Worksheet", "تعديل ورقة العمل") : tt("Upload Worksheet", "رفع ورقة عمل")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder={tt("Title (Arabic)", "العنوان بالعربية")} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" />
            <Input placeholder={tt("Title (English, optional)", "العنوان بالإنجليزية (اختياري)")} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <Textarea placeholder={tt("Description (optional)", "الوصف (اختياري)")} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

          <div className="rounded-md border p-3">
            <h4 className="mb-2 text-xs font-bold text-muted-foreground">{tt("Curriculum placement", "التصنيف المنهجي")}</h4>
            {grades.length === 0 && (
              <p className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {tt(
                  "No curriculum data exists yet. Ask an admin to add at least one grade and subject in Curriculum Manager (Library → Curriculum Manager) before uploading.",
                  "لا توجد بيانات منهج حتى الآن. اطلب من المسؤول إضافة صف ومادة واحدة على الأقل في إدارة المنهج (المكتبة → إدارة المنهج) قبل الرفع."
                )}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Select value={gradeId} onValueChange={(v) => { setGradeId(v); setSubjectId(""); setUnitId("none"); setLessonId("none") }} disabled={grades.length === 0}>
                <SelectTrigger><SelectValue placeholder={tt("Grade *", "الصف *")} /></SelectTrigger>
                <SelectContent>{grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name_ar}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setUnitId("none"); setLessonId("none") }} disabled={!gradeId}>
                <SelectTrigger><SelectValue placeholder={tt("Subject *", "المادة *")} /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue placeholder={tt("Term", "الفصل الدراسي")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt("Any term", "أي فصل")}</SelectItem>
                  {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={worksheetType} onValueChange={setWorksheetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WORKSHEET_TYPES.map((w) => <SelectItem key={w.value} value={w.value}>{tt(w.en, w.ar)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={unitId} onValueChange={(v) => { setUnitId(v); setLessonId("none") }} disabled={!subjectId}>
                <SelectTrigger><SelectValue placeholder={tt("Unit (optional)", "الوحدة (اختياري)")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt("No unit", "بدون وحدة")}</SelectItem>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={lessonId} onValueChange={setLessonId} disabled={unitId === "none"}>
                <SelectTrigger><SelectValue placeholder={tt("Lesson (optional)", "الدرس (اختياري)")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt("No lesson", "بدون درس")}</SelectItem>
                  {lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.name_ar}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {chipFacets.length > 0 && (
            <div className="rounded-md border p-3">
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">{tt("Tags", "الوسوم")}</h4>
              <div className="space-y-2">
                {chipFacets.map((f) => (
                  <div key={f.id}>
                    <div className="mb-1 text-xs text-muted-foreground">{f.name_ar}</div>
                    <div className="flex flex-wrap gap-1">
                      {f.values.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleFacetValue(v.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                            selectedFacetValueIds.has(v.id) ? "border-blue-600 bg-blue-600 text-white" : "border-input hover:bg-accent"
                          )}
                        >
                          {v.label_ar}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Select value={visibilityScope} onValueChange={(v) => setVisibilityScope(v as typeof visibilityScope)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="private">{tt("Private (only me)", "خاص (لي فقط)")}</SelectItem>
              <SelectItem value="school">{tt("My school", "مدرستي")}</SelectItem>
              <SelectItem value="public">{tt("Public (all schools)", "عام (كل المدارس)")}</SelectItem>
            </SelectContent>
          </Select>

          <DropField
            label={tt("Worksheet file (PDF/image)", "ملف ورقة العمل (PDF/صورة)")}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            file={file}
            onFile={setFile}
            hint={editing ? tt("Leave empty to keep the current file", "اتركه فارغًا للاحتفاظ بالملف الحالي") : tt("Click or drop a file", "انقر أو اسحب ملفًا")}
          />
          <DropField label={tt("Thumbnail (optional)", "صورة مصغرة (اختياري)")} accept="image/jpeg,image/png,image/webp" file={thumbnail} onFile={setThumbnail} hint={tt("Click or drop an image", "انقر أو اسحب صورة")} />
          <DropField label={tt("Answer key (optional)", "نموذج الإجابة (اختياري)")} accept="application/pdf,image/jpeg,image/png,image/webp" file={answerKey} onFile={setAnswerKey} hint={tt("Click or drop a file", "انقر أو اسحب ملفًا")} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tt("Cancel", "إلغاء")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? tt("Saving…", "جارٍ الحفظ…") : tt("Save", "حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
