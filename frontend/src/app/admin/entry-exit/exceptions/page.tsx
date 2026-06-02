"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Search, Loader2, Trash2, AlertTriangle, ShieldX } from "lucide-react"
import * as api from "@/lib/api/entry-exit"
import { useEffect } from "react"
import { getCheckpoints } from "@/lib/api/entry-exit"
import type { Checkpoint } from "@/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type SchoolException = {
  id: string
  person_id: string
  person_type: "STUDENT" | "STAFF"
  person_name?: string
  from_date: string
  to_date: string
  reason: string | null
  created_at: string
  checkpoint_id: string
  record_type: string
  checkpoint_name?: string
}

const RECORD_TYPE_OPTIONS = [
  { value: "ENTRY_AND_EXIT", key: "type_entry_exit" },
  { value: "ENTRY", key: "type_entry" },
  { value: "EXIT", key: "type_exit" },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const t = useTranslations("school.entry_exit.exceptions")
  const { profile } = useAuth()
  const schoolId = profile?.school_id || ""

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [exceptions, setExceptions] = useState<SchoolException[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Filters
  const [fromDate, setFromDate] = useState(todayStr())
  const [fromTime, setFromTime] = useState("")
  const [toDate, setToDate] = useState("")
  const [toTime, setToTime] = useState("")
  const [filterCheckpoint, setFilterCheckpoint] = useState("all")
  const [filterType, setFilterType] = useState("ENTRY_AND_EXIT")

  // Search (client-side)
  const [searchQuery, setSearchQuery] = useState("")

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Active tab: STUDENT or USERS
  const [activeTab, setActiveTab] = useState<"STUDENT" | "STAFF">("STUDENT")

  useEffect(() => {
    if (!schoolId) return
    getCheckpoints(schoolId).then(setCheckpoints).catch(() => {})
  }, [schoolId])

  const search = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setHasSearched(true)
    try {
      const result = await api.getSchoolExceptions(schoolId, {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        checkpoint_id: filterCheckpoint === "all" ? undefined : filterCheckpoint,
        record_type: filterType === "ENTRY_AND_EXIT" ? undefined : filterType,
      })
      setExceptions(result as SchoolException[])
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error_load"))
    } finally {
      setLoading(false)
    }
  }, [schoolId, fromDate, toDate, filterCheckpoint, filterType, t])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await api.deleteExceptionById(deleteId)
      setExceptions(prev => prev.filter(e => e.id !== deleteId))
      setDeleteId(null)
      toast.success(t("msg_success_removed"))
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error_delete"))
    } finally {
      setDeleting(false)
    }
  }

  const visible = exceptions.filter(e => {
    const matchTab = activeTab === "STUDENT" ? e.person_type === "STUDENT" : e.person_type === "STAFF"
    const matchSearch = !searchQuery ||
      (e.person_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.person_id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchTab && matchSearch
  })

  const rtLabel = (rt: string) => {
    if (rt === "ENTRY") return t("type_entry")
    if (rt === "EXIT") return t("type_exit")
    return t("type_entry_exit")
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
          <ShieldX className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("page_title")}</h1>
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

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("label_from_date")}</Label>
              <Input type="date" className="h-8 w-36 text-xs" value={fromDate}
                onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("label_time")}</Label>
              <Input type="time" className="h-8 w-28 text-xs" value={fromTime}
                onChange={e => setFromTime(e.target.value)} placeholder="HH:MM" />
            </div>

            <span className="text-muted-foreground text-sm self-end mb-1">- {t("label_to")}</span>

            <div className="space-y-1">
              <Label className="text-xs">{t("label_to_date")}</Label>
              <Input type="date" className="h-8 w-36 text-xs" value={toDate}
                min={fromDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("label_time")}</Label>
              <Input type="time" className="h-8 w-28 text-xs" value={toTime}
                onChange={e => setToTime(e.target.value)} placeholder="HH:MM" />
            </div>

            <Button className="h-8 px-5 self-end" onClick={search} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("btn_go")}
            </Button>
          </div>

          {/* Second filter row */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">{t("label_checkpoint")}</Label>
              <Select value={filterCheckpoint} onValueChange={setFilterCheckpoint}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {checkpoints.map(cp => (
                    <SelectItem key={cp.id} value={cp.id}>{cp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs whitespace-nowrap">{t("label_type")}</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search within results */}
      {hasSearched && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {loading ? t("msg_loading") : t("stat_found", { count: visible.length })}
          </p>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder={t("toolbar_search")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      {!hasSearched ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            {t("msg_filter_prompt")}
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-14 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("msg_no_data")}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_person")}</TableHead>
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_checkpoint")}</TableHead>
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_type")}</TableHead>
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_from")}</TableHead>
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_to")}</TableHead>
                <TableHead className="text-xs uppercase font-semibold">{t("table_col_reason")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(ex => (
                <TableRow key={ex.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">
                    {ex.person_name || (
                      <span className="text-muted-foreground text-xs font-mono">
                        {ex.person_id.slice(0, 12)}…
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{ex.checkpoint_name || ex.checkpoint_id.slice(0, 8) + "…"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {rtLabel(ex.record_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{ex.from_date}</TableCell>
                  <TableCell className="text-sm">{ex.to_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ex.reason || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(ex.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> {t("dialog_remove_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("dialog_remove_desc")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("btn_cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {t("btn_remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
