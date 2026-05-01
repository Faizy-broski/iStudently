"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import { toast } from "sonner"
import { Search, Loader2, ShieldX, Users, Download } from "lucide-react"
import * as api from "@/lib/api/entry-exit"
import { getCheckpoints, searchStudents } from "@/lib/api/entry-exit"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import type { Checkpoint } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface StudentRecord {
  id?: string
  student_id?: string
  first_name?: string
  last_name?: string
  student_name?: string
  admission_number?: string
  student_number?: string
  grade_level_id?: string
  grade_level?: string
  grade_name?: string
  section_id?: string
  section?: string
  profiles?: { first_name?: string; last_name?: string }
}

function studentId(s: StudentRecord) {
  return String(s.id ?? s.student_id ?? "")
}

function studentName(s: StudentRecord) {
  if (s.student_name) return s.student_name
  const first = s.first_name || s.profiles?.first_name || ""
  const last = s.last_name || s.profiles?.last_name || ""
  return `${first} ${last}`.trim()
}

function studentNumber(s: StudentRecord) {
  return s.admission_number || s.student_number || ""
}

function studentGrade(s: StudentRecord) {
  return s.grade_name || s.grade_level || ""
}

const RECORD_TYPE_OPTIONS = [
  { value: "ENTRY_AND_EXIT", key: "type_entry_exit" },
  { value: "ENTRY", key: "type_entry" },
  { value: "EXIT", key: "type_exit" },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddExceptionsPage() {
  const t = useTranslations("school.entry_exit.exceptions")
  const { user, profile } = useAuth()
  const schoolId = profile?.school_id || ""
  const userName = (user as { name?: string })?.name || ""

  // Form state
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [checkpointId, setCheckpointId] = useState("all")
  const [recordType, setRecordType] = useState("ENTRY_AND_EXIT")
  const [fromDate, setFromDate] = useState(todayStr())
  const [fromTime, setFromTime] = useState("")
  const [toDate, setToDate] = useState(todayStr())
  const [toTime, setToTime] = useState("")
  const [reason, setReason] = useState("")

  // Student table
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterGrade, setFilterGrade] = useState("all")
  const [filterSection, setFilterSection] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<"STUDENT" | "STAFF">("STUDENT")

  const { gradeLevels } = useGradeLevels()
  const { sections } = useSections()

  const filteredSections = useMemo(() => {
    if (filterGrade === "all") return sections
    return sections.filter(s => s.grade_level_id === filterGrade)
  }, [sections, filterGrade])

  // Load checkpoints
  useEffect(() => {
    if (!schoolId) return
    getCheckpoints(schoolId).then(setCheckpoints).catch(() => {})
  }, [schoolId])

  // Load students (debounced)
  const loadStudents = useCallback(async () => {
    if (!schoolId) return
    setLoadingStudents(true)
    try {
      const data = await searchStudents(schoolId, searchQuery || undefined) as StudentRecord[]
      setStudents(data)
      setSelected(new Set())
    } catch {
      toast.error(t("msg_error_load_students"))
    } finally {
      setLoadingStudents(false)
    }
  }, [schoolId, searchQuery])

  useEffect(() => {
    const t = setTimeout(() => void loadStudents(), 300)
    return () => clearTimeout(t)
  }, [loadStudents])

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterGrade !== "all") {
        if (s.grade_level_id !== filterGrade && s.grade_level !== filterGrade) return false
      }
      if (filterSection !== "all") {
        if (s.section_id !== filterSection && s.section !== filterSection) return false
      }
      return true
    })
  }, [students, filterGrade, filterSection])

  // Selection helpers
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === filteredStudents.length
        ? new Set()
        : new Set(filteredStudents.map(s => studentId(s)))
    )
  }

  const allSelected = filteredStudents.length > 0 && selected.size === filteredStudents.length

  // Submit
  async function handleSubmit() {
    if (!fromDate) { toast.error(t("msg_error_from_date")); return }
    if (!toDate) { toast.error(t("msg_error_to_date")); return }
    if (selected.size === 0) { toast.error(t("msg_error_no_selection")); return }

    setSubmitting(true)
    try {
      const result = await api.bulkCreateExceptions({
        school_id: schoolId,
        person_ids: [...selected],
        person_type: activeTab,
        checkpoint_id: checkpointId === "all" ? undefined : checkpointId,
        record_type: recordType === "ENTRY_AND_EXIT" ? undefined : recordType,
        from_date: fromDate,
        to_date: toDate,
        reason: reason || undefined,
        created_by: userName,
      })
      toast.success(
        result.created === 0
          ? t("msg_no_rules_found")
          : t("msg_success_bulk_created", { count: result.created })
      )
      setSelected(new Set())
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error_create"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <ShieldX className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("page_title")}</h1>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("btn_add_bulk", { type: activeTab === "STUDENT" ? t("tab_students") : t("tab_users"), count: selected.size })}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 text-sm font-medium border-b pb-2">
        <button
          onClick={() => setActiveTab("STUDENT")}
          className={`pb-2 -mb-2 border-b-2 transition-colors ${
            activeTab === "STUDENT"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tab_students")}
        </button>
        <button
          onClick={() => setActiveTab("STAFF")}
          className={`pb-2 -mb-2 border-b-2 transition-colors ${
            activeTab === "STAFF"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tab_users")}
        </button>
      </div>

      {/* Add Exceptions form card */}
      <Card className="border shadow-sm max-w-sm mx-auto">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-center tracking-widest uppercase text-muted-foreground">
            {t("card_add_title")}
          </h2>

          {/* Checkpoint */}
          <div className="space-y-1">
            <Select value={checkpointId} onValueChange={setCheckpointId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="N/A" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("option_na_all")}</SelectItem>
                {checkpoints.map(cp => (
                  <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-500 font-medium pl-1">{t("label_checkpoint")}</p>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Select value={recordType} onValueChange={setRecordType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-500 font-medium pl-1">{t("label_type")}</p>
          </div>

          {/* From */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("label_from")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input type="date" className="h-9 text-sm" value={fromDate}
                  onChange={e => setFromDate(e.target.value)} />
                <p className="text-xs text-muted-foreground pl-1 mt-0.5">{t("label_date")}</p>
              </div>
              <div>
                <Input type="time" className="h-9 text-sm" value={fromTime}
                  onChange={e => setFromTime(e.target.value)} />
                <p className="text-xs text-red-500 pl-1 mt-0.5">{t("label_time")}</p>
              </div>
            </div>
          </div>

          {/* To */}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t("label_to")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input type="date" className="h-9 text-sm" value={toDate}
                  min={fromDate} onChange={e => setToDate(e.target.value)} />
                <p className="text-xs text-muted-foreground pl-1 mt-0.5">{t("label_date")}</p>
              </div>
              <div>
                <Input type="time" className="h-9 text-sm" value={toTime}
                  onChange={e => setToTime(e.target.value)} />
                <p className="text-xs text-red-500 pl-1 mt-0.5">{t("label_time")}</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <Input className="h-9 text-sm" placeholder="" value={reason}
              onChange={e => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground pl-1">{t("label_reason")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Student table section */}
      <div className="space-y-3 pt-2">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterGrade} onValueChange={v => { setFilterGrade(v); setFilterSection("all") }}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder={t("placeholder_grade")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("option_all_grades")}</SelectItem>
              {gradeLevels.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder={t("placeholder_section")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("option_all_sections")}</SelectItem>
              {filteredSections.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground ml-1">
            <Users className="h-3.5 w-3.5" />
            <span>{t("stat_found", { count: filteredStudents.length })}</span>
            <Download className="h-3.5 w-3.5 ml-1 cursor-pointer hover:text-foreground" />
          </div>

          <div className="relative ml-auto w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder={t("toolbar_search")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {loadingStudents ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("msg_no_data")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      className="h-4 w-4"
                    />
                  </TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-blue-600">
                    {activeTab === "STUDENT" ? t("table_col_person") : t("table_col_person")}
                  </TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-blue-600">
                    {t("table_col_id", { type: activeTab === "STUDENT" ? t("tab_students") : t("tab_users") })}
                  </TableHead>
                  <TableHead className="text-xs uppercase font-semibold text-blue-600">
                    {t("table_col_grade")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map(s => {
                  const sid = studentId(s)
                  const isSelected = selected.has(sid)
                  return (
                    <TableRow
                      key={sid}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleOne(sid)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(sid)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{studentName(s)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{studentNumber(s) || "—"}</TableCell>
                      <TableCell className="text-sm">{studentGrade(s)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Bottom action button */}
        {filteredStudents.length > 0 && (
          <div className="flex justify-center py-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              className="px-8 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("btn_add_bulk", { type: activeTab === "STUDENT" ? t("tab_students") : t("tab_users"), count: selected.size })}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
