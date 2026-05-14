"use client"

import { useState, useEffect, useCallback, useId } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Users,
  AlertTriangle,
  ShieldCheck,
  Save,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as api from "@/lib/api/entry-exit"
import { useGradeLevels } from "@/hooks/useAcademics"
import type { AutomaticRecord, AutomaticRecordException, Checkpoint } from "@/types"

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_KEYS: Record<number, string> = {
  1: "day_monday", 2: "day_tuesday", 3: "day_wednesday",
  4: "day_thursday", 5: "day_friday", 6: "day_saturday", 0: "day_sunday",
}
const DEFAULT_DAYS = new Set([1, 2, 3, 4, 5])

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RuleRow {
  uid: string
  existingIds: Record<number, string>
  checkpoint_id: string
  record_type: "ENTRY" | "EXIT"
  from_date: string
  to_date: string
  days: Set<number>
  only_school_days: boolean
  scheduled_time: string
  comments: string
  user_profiles: string
  grade_levels: string
  is_active: boolean
  isDirty: boolean
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function groupKey(r: AutomaticRecord) {
  return `${r.checkpoint_id}|${r.record_type}|${r.scheduled_time}|${r.target_type}|${r.target_value ?? ""}`
}

function ruleToRows(rules: AutomaticRecord[]): RuleRow[] {
  const map = new Map<string, RuleRow>()
  for (const r of rules) {
    const k = groupKey(r)
    const existing = map.get(k)
    if (existing) {
      existing.days.add(r.day_of_week)
      existing.existingIds[r.day_of_week] = r.id
    } else {
      map.set(k, {
        uid: `loaded-${r.id}`,
        existingIds: { [r.day_of_week]: r.id },
        checkpoint_id: r.checkpoint_id,
        record_type: r.record_type,
        from_date: "",
        to_date: "",
        days: new Set([r.day_of_week]),
        only_school_days: false,
        scheduled_time: r.scheduled_time,
        comments: "",
        user_profiles: r.target_type === "staff_profile" ? (r.target_value ?? "") : "",
        grade_levels: r.target_type === "grade_level" ? (r.target_value ?? "") : "",
        is_active: r.is_active,
        isDirty: false,
      })
    }
  }
  return [...map.values()]
}

let _uid = 0
function nextUid() { return `new-${++_uid}` }

function emptyRow(defaultCheckpointId = ""): RuleRow {
  return {
    uid: nextUid(),
    existingIds: {},
    checkpoint_id: defaultCheckpointId,
    record_type: "ENTRY",
    from_date: "",
    to_date: "",
    days: new Set(DEFAULT_DAYS),
    only_school_days: false,
    scheduled_time: "",
    comments: "",
    user_profiles: "",
    grade_levels: "",
    is_active: true,
    isDirty: true,
  }
}

// â”€â”€â”€ Exceptions inline panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ExceptionsPanel({
  row,
  schoolId,
  userName,
}: {
  row: RuleRow
  schoolId: string
  userName: string
}) {
  const t = useTranslations("school.entry_exit.automatic_records")
  const commonT = useTranslations("common")
  const [exceptions, setExceptions] = useState<AutomaticRecordException[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [personId, setPersonId] = useState("")
  const [personType, setPersonType] = useState<"STUDENT" | "STAFF">("STUDENT")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const ruleId = Object.values(row.existingIds)[0]

  useEffect(() => {
    if (!ruleId) return
    setLoading(true)
    api.getAutomaticRecordExceptions(ruleId)
      .then(setExceptions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ruleId])

  async function handleAdd() {
    if (!personId || !fromDate || !toDate) { toast.error(commonT("fill_required_fields")); return }
    if (!ruleId) return
    setSaving(true)
    try {
      const ex = await api.createAutomaticRecordException({
        school_id: schoolId,
        automatic_record_id: ruleId,
        person_id: personId,
        person_type: personType,
        from_date: fromDate,
        to_date: toDate,
        reason,
        created_by: userName,
      })
      setExceptions(p => [ex, ...p])
      setShowAdd(false)
      setPersonId(""); setFromDate(""); setToDate(""); setReason("")
      toast.success(t("msg_success_added_exception"))
    } catch (err: unknown) { toast.error((err as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!ruleId) return
    try {
      await api.deleteAutomaticRecordException(ruleId, id)
      setExceptions(p => p.filter(e => e.id !== id))
      setDeleteId(null)
      toast.success(t("msg_success_deleted_exception"))
    } catch (err: unknown) { toast.error((err as Error).message) }
  }

  if (!ruleId) {
    return <p className="text-xs text-muted-foreground italic p-4">{t("msg_save_first_exceptions")}</p>
  }

  return (
    <div className="p-4 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> {t("exceptions_panel_title")}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => setShowAdd(v => !v)}>
          <Plus className="h-3 w-3" /> {t("btn_add_exception")}
        </Button>
      </div>
      {showAdd && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-lg bg-background border">
          <Select value={personType} onValueChange={v => setPersonType(v as "STUDENT" | "STAFF")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STUDENT">{t("option_student")}</SelectItem>
              <SelectItem value="STAFF">{t("option_staff")}</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs" placeholder={t("placeholder_person_uuid")} value={personId}
            onChange={e => setPersonId(e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={fromDate}
            onChange={e => setFromDate(e.target.value)} />
          <Input type="date" className="h-8 text-xs" value={toDate} min={fromDate}
            onChange={e => setToDate(e.target.value)} />
          <Input className="h-8 text-xs col-span-2 sm:col-span-1" placeholder={t("placeholder_reason")}
            value={reason} onChange={e => setReason(e.target.value)} />
          <Button size="sm" className="h-8 text-xs col-span-2 sm:col-span-5 sm:w-fit"
            onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} {t("btn_save_exception")}
          </Button>
        </div>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("msg_loading_exceptions")}</p>
      ) : exceptions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("msg_no_exceptions")}</p>
      ) : (
        <div className="space-y-1">
          {exceptions.map(ex => (
            <div key={ex.id} className="flex items-center justify-between text-xs rounded-md border px-3 py-2 bg-background">
              <span>
                <span className="font-medium">{ex.person_name || ex.person_id.slice(0, 12) + "â€¦"}</span>
                <span className="text-muted-foreground ml-2">{ex.from_date} â†’ {ex.to_date}</span>
                {ex.reason && <span className="text-muted-foreground ml-2">Â· {ex.reason}</span>}
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteId(ex.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />{t("dialog_remove_exception_title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("dialog_remove_exception_desc")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("btn_cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>{t("btn_remove")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AutomaticRecordsPage() {
  const t = useTranslations("school.entry_exit.automatic_records")
  const commonT = useTranslations("common")
  const { user, profile } = useAuth()
  const schoolId = profile?.school_id || ""
  const userName = (user as { name?: string })?.name || ""

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [rows, setRows] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterCheckpoint, setFilterCheckpoint] = useState("all")
  const [expandedUid, setExpandedUid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { gradeLevels } = useGradeLevels()
  const uid = useId()

  // â”€â”€ Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const [rules, cps] = await Promise.all([
        api.getAutomaticRecords(schoolId),
        api.getCheckpoints(schoolId),
      ])
      setCheckpoints(cps)
      setRows(ruleToRows(rules))
    } catch {
      toast.error(t("msg_error_load"))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => { void load() }, [load])

  // â”€â”€ Row helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function updateRow(rowUid: string, patch: Partial<RuleRow>) {
    setRows(prev => prev.map(r =>
      r.uid === rowUid ? { ...r, ...patch, isDirty: true } : r
    ))
  }

  function toggleDay(rowUid: string, day: number) {
    setRows(prev => prev.map(r => {
      if (r.uid !== rowUid) return r
      const days = new Set(r.days)
      if (days.has(day)) { days.delete(day) } else { days.add(day) }
      return { ...r, days, isDirty: true }
    }))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(checkpoints[0]?.id ?? "")])
  }

  // â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function confirmDelete() {
    if (!deleteTarget) return
    const row = rows.find(r => r.uid === deleteTarget)
    if (row) {
      const ids = Object.values(row.existingIds)
      if (ids.length > 0) {
        try {
          await Promise.all(ids.map(id => api.deleteAutomaticRecord(id)))
        } catch (err: unknown) {
          toast.error((err as Error).message || t("msg_error_delete"))
          setDeleteTarget(null)
          return
        }
      }
    }
    setRows(prev => prev.filter(r => r.uid !== deleteTarget))
    if (expandedUid === deleteTarget) setExpandedUid(null)
    setDeleteTarget(null)
    toast.success(t("msg_success_deleted"))
  }

  // â”€â”€ Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSave() {
    const dirty = rows.filter(r => r.isDirty)
    if (dirty.length === 0) { toast.info(t("msg_no_changes")); return }
    for (const row of dirty) {
      if (!row.checkpoint_id) { toast.error(t("msg_error_checkpoint")); return }
      if (!row.scheduled_time) { toast.error(t("msg_error_time")); return }
      if (row.days.size === 0) { toast.error(t("msg_error_days")); return }
    }
    setSaving(true)
    try {
      for (const row of dirty) {
        const target_type = row.grade_levels
          ? "grade_level"
          : row.user_profiles
          ? "staff_profile"
          : "all_students"
        const target_value = row.grade_levels || row.user_profiles || null

        // Delete days that were removed
        for (const day of Object.keys(row.existingIds).map(Number)) {
          if (!row.days.has(day)) {
            await api.deleteAutomaticRecord(row.existingIds[day])
            delete row.existingIds[day]
          }
        }

        // Create / update for each checked day
        for (const day of row.days) {
          const existingId = row.existingIds[day]
          const payload = {
            checkpoint_id: row.checkpoint_id,
            record_type: row.record_type,
            day_of_week: day,
            scheduled_time: row.scheduled_time,
            target_type,
            target_value,
            is_active: row.is_active,
          }
          if (existingId) {
            await api.updateAutomaticRecord(existingId, payload)
          } else {
            const created = await api.createAutomaticRecord({
              school_id: schoolId,
              created_by: userName,
              ...payload,
            })
            row.existingIds[day] = created.id
          }
        }
        row.isDirty = false
      }
      setRows(prev => prev.map(r => ({ ...r, isDirty: false })))
      toast.success(t("msg_save_success"))
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error_save"))
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = filterCheckpoint === "all"
    ? rows
    : rows.filter(r => r.checkpoint_id === filterCheckpoint)

  const dirtyCount = rows.filter(r => r.isDirty).length

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("page_title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("page_subtitle")}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || dirtyCount === 0} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("btn_save")}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
        </Button>
      </div>

      {/* Top filter + Add */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">{t("label_checkpoint_filter")}</Label>
          <Select value={filterCheckpoint} onValueChange={setFilterCheckpoint}>
            <SelectTrigger className="w-44 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{commonT("all")}</SelectItem>
              {checkpoints.map(cp => (
                <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" /> {t("btn_add_rule")}
          </Button>
        </CardContent>
      </Card>

      {/* Inline rules table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> {commonT("loading")}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-14 text-center text-muted-foreground space-y-3">
            <p className="text-sm font-medium">{t("msg_no_data")}</p>
            <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t("btn_add_first_rule")}
            </Button>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="hidden lg:grid lg:grid-cols-[2rem_1fr_0.9fr_1fr_0.7fr_0.8fr_1fr_2rem] gap-x-4 px-4 py-2 bg-muted/40 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span />
              <span>{t("table_header_checkpoint")}</span>
              <span>{t("table_header_timeframe")}</span>
              <span>{t("table_header_days")}</span>
              <span>{t("table_header_time")}</span>
              <span>{t("table_header_comments")}</span>
              <span>{t("table_header_limit_to")}</span>
              <span />
            </div>

            {visibleRows.map((row, idx) => (
              <div key={row.uid} className={idx > 0 ? "border-t" : ""}>
                {/* Row */}
                <div className="grid grid-cols-1 lg:grid-cols-[2rem_1fr_0.9fr_1fr_0.7fr_0.8fr_1fr_2rem] gap-4 px-4 py-4 items-start">

                  {/* Exceptions toggle */}
                  <div className="hidden lg:flex flex-col items-center pt-1">
                    <button
                      title={t("tooltip_exceptions")}
                      onClick={() => setExpandedUid(expandedUid === row.uid ? null : row.uid)}
                      className={`h-6 w-6 rounded flex items-center justify-center text-xs border transition-colors ${
                        expandedUid === row.uid
                          ? "bg-blue-100 border-blue-400 text-blue-700"
                          : "hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <Users className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Checkpoint + Type */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground lg:hidden">{t("table_header_checkpoint")}</p>
                    <Select value={row.checkpoint_id}
                      onValueChange={v => updateRow(row.uid, { checkpoint_id: v })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={t("placeholder_na")} />
                      </SelectTrigger>
                      <SelectContent>
                        {checkpoints.map(cp => (
                          <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={row.record_type}
                      onValueChange={v => updateRow(row.uid, { record_type: v as "ENTRY" | "EXIT" })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENTRY">{t("type_entry")}</SelectItem>
                        <SelectItem value="EXIT">{t("type_exit")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Timeframe */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground lg:hidden">{t("table_header_timeframe")}</p>
                    <div>
                      <Input type="date" className="h-8 text-xs" value={row.from_date}
                        onChange={e => updateRow(row.uid, { from_date: e.target.value })} />
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{t("label_from")}</p>
                    </div>
                    <div>
                      <Input type="date" className="h-8 text-xs" value={row.to_date}
                        min={row.from_date}
                        onChange={e => updateRow(row.uid, { to_date: e.target.value })} />
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{t("label_to")}</p>
                    </div>
                  </div>

                  {/* Days */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground lg:hidden mb-1">{t("table_header_days")}</p>
                    <div className="space-y-1">
                      {DAY_ORDER.map(day => (
                        <div key={day} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`${uid}-${row.uid}-d${day}`}
                            checked={row.days.has(day)}
                            onCheckedChange={() => toggleDay(row.uid, day)}
                            className="h-3.5 w-3.5"
                          />
                          <label htmlFor={`${uid}-${row.uid}-d${day}`}
                            className="text-xs cursor-pointer select-none">
                            {t(DAY_KEYS[day])}
                          </label>
                        </div>
                      ))}
                      <Separator className="my-1.5" />
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id={`${uid}-${row.uid}-school`}
                          checked={row.only_school_days}
                          onCheckedChange={v => updateRow(row.uid, { only_school_days: !!v })}
                          className="h-3.5 w-3.5"
                        />
                        <label htmlFor={`${uid}-${row.uid}-school`}
                          className="text-xs cursor-pointer select-none">
                          {t("label_school_days_only")}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground lg:hidden mb-1">{t("table_header_time")}</p>
                    <Input type="time" className="h-8 text-xs" value={row.scheduled_time}
                      onChange={e => updateRow(row.uid, { scheduled_time: e.target.value })} />
                    {row.isDirty && (
                      <Badge variant="outline"
                        className="mt-1 text-[10px] px-1 py-0 h-4 border-amber-400 text-amber-600">
                        {t("badge_unsaved")}
                      </Badge>
                    )}
                  </div>

                  {/* Comments */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground lg:hidden mb-1">{t("table_header_comments")}</p>
                    <Input className="h-8 text-xs" placeholder={t("placeholder_comments")} value={row.comments}
                      onChange={e => updateRow(row.uid, { comments: e.target.value })} />
                  </div>

                  {/* Limit To */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground lg:hidden">{t("table_header_limit_to")}</p>
                    <div>
                      <Input className="h-8 text-xs" placeholder={t("placeholder_user_profile")}
                        value={row.user_profiles}
                        onChange={e => updateRow(row.uid, { user_profiles: e.target.value, grade_levels: "" })} />
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{t("label_user_profiles")}</p>
                    </div>
                    <div>
                      <Select value={row.grade_levels || "__none__"}
                        onValueChange={v => updateRow(row.uid, {
                          grade_levels: v === "__none__" ? "" : v,
                          user_profiles: "",
                        })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Grade Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("option_none")}</SelectItem>
                          {gradeLevels.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{t("label_grade_levels")}</p>
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="flex items-start justify-end lg:pt-1">
                    <Button variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(row.uid)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Exceptions sub-panel */}
                {expandedUid === row.uid && (
                  <div className="border-t">
                    <ExceptionsPanel row={row} schoolId={schoolId} userName={userName} />
                  </div>
                )}
              </div>
            ))}

            {/* Add-row footer */}
            <div className="border-t px-4 py-2.5">
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" /> {t("btn_add_another")}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Bottom save */}
      {dirtyCount > 0 && (
        <div className="flex justify-center pb-2">
          <Button onClick={handleSave} disabled={saving} className="px-10 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("btn_save")}
          </Button>
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> {t("dialog_delete_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("dialog_delete_desc")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("btn_cancel")}</Button>
            <Button variant="destructive" onClick={confirmDelete}>{t("btn_confirm_delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
