"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Plus, Trash2, Loader2, Search, BookOpen, AlertCircle, ChevronLeft, ChevronRight,
  FileText, TrendingDown, TrendingUp, Settings2,
} from "lucide-react"
import { format } from "date-fns"
import {
  getCatalog, getLogs, createLog, deleteLog,
  type PerformanceActionLookup, type StaffPerformanceLog,
} from "@/lib/api/performance"
import { useStaff } from "@/hooks/useStaff"
import type { Staff } from "@/lib/api/staff"
import { useCampus } from "@/context/CampusContext"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESCALATION_COLORS: Record<string, string> = {
  none:            "bg-gray-100 text-gray-700",
  verbal_alert:    "bg-yellow-100 text-yellow-700",
  written_warning: "bg-orange-100 text-orange-700",
  final_warning:   "bg-red-100 text-red-800",
}
const ESCALATION_LABELS: Record<string, string> = {
  none: "None", verbal_alert: "Verbal Alert",
  written_warning: "Written Warning", final_warning: "Final Warning",
}

function staffName(s: Staff): string {
  const first = s.profile?.first_name || ""
  const last  = s.profile?.last_name  || ""
  return `${first} ${last}`.trim() || s.employee_number
}

function logStaffName(log: StaffPerformanceLog): string {
  const p = log.staff?.profiles
  if (!p) return log.staff_id
  return `${p.first_name || ""} ${p.last_name || ""}`.trim() || log.staff_id
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerformanceAdminPage() {
  const router = useRouter()
  const campusCtx = useCampus()
  const activeCampusId = campusCtx?.selectedCampus?.id

  const [logs, setLogs]         = useState<StaffPerformanceLog[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loadingLogs, setLoadingLogs] = useState(true)

  const [catalog, setCatalog] = useState<PerformanceActionLookup[]>([])

  // Filters
  const [searchStaff, setSearchStaff] = useState("")
  const [filterType,  setFilterType]  = useState("all")

  // Staff search for record dialog — scope to active campus
  const [staffSearch, setStaffSearch] = useState("")
  const { staff: staffList, isLoading: staffLoading } = useStaff(1, 50, staffSearch || undefined, 'all', activeCampusId)

  // Dialog
  const [dialogOpen, setDialogOpen]         = useState(false)
  const [selectedStaff, setSelectedStaff]   = useState<Staff | null>(null)
  const [selectedAction, setSelectedAction] = useState<PerformanceActionLookup | null>(null)
  const [customPoints,   setCustomPoints]   = useState<string>("")
  const [customFine,     setCustomFine]     = useState<string>("")
  const [notes,          setNotes]          = useState("")
  const [saving,         setSaving]         = useState(false)

  const LIMIT = 20

  // Reset to page 1 when campus changes
  useEffect(() => { setPage(1) }, [activeCampusId])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const r = await getLogs({ page, limit: LIMIT, campusId: activeCampusId })
      setLogs(r.data)
      setTotal(r.total)
    } catch { toast.error("Failed to load incidents") }
    finally  { setLoadingLogs(false) }
  }, [page, activeCampusId])

  useEffect(() => { loadLogs() }, [loadLogs])

  useEffect(() => {
    getCatalog(true).then(setCatalog).catch(() => {})
  }, [])

  // When action changes, pre-fill overrides with catalog defaults
  const handleActionSelect = (id: string) => {
    const action = catalog.find(a => a.id === id) || null
    setSelectedAction(action)
    if (action) {
      setCustomPoints(String(action.default_points))
      setCustomFine(String(action.default_fine))
    }
  }

  const openRecordDialog = () => {
    setSelectedStaff(null); setSelectedAction(null)
    setCustomPoints(""); setCustomFine(""); setNotes("")
    setStaffSearch(""); setDialogOpen(true)
  }

  const handleRecord = async () => {
    if (!selectedStaff || !selectedAction) {
      toast.error("Select a staff member and an action")
      return
    }
    setSaving(true)
    try {
      const result = await createLog({
        staff_id:     selectedStaff.id,
        action_id:    selectedAction.id,
        campus_id:    activeCampusId || undefined,
        custom_points: customPoints !== "" && customPoints !== String(selectedAction.default_points)
          ? Number(customPoints) : null,
        custom_fine:   customFine !== "" && customFine !== String(selectedAction.default_fine)
          ? Number(customFine) : null,
        notes: notes || undefined,
      })
      toast.success("Incident recorded")
      if (result.letter_generated) {
        toast.info("Disciplinary letter flagged for generation — see letter button on the row")
      }
      setDialogOpen(false)
      loadLogs()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this incident? Any salary adjustment will be reversed.")) return
    try {
      await deleteLog(id)
      toast.success("Incident deleted and salary reversed if applicable")
      loadLogs()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Client-side filter on loaded data for instant UX
  const displayed = logs.filter(log => {
    const nameMatch = searchStaff
      ? logStaffName(log).toLowerCase().includes(searchStaff.toLowerCase()) ||
        (log.staff?.employee_number || "").toLowerCase().includes(searchStaff.toLowerCase())
      : true
    const typeMatch = filterType === "all" || log.action?.action_type === filterType
    return nameMatch && typeMatch
  })

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
            Performance &amp; Efficiency
          </h1>
          <p className="text-sm text-muted-foreground">معدلات الأداء والكفاءة — Staff incident log</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/performance/catalog")}>
            <Settings2 className="mr-2 h-4 w-4" />
            Manage Catalog
          </Button>
          <Button onClick={openRecordDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Record Incident
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Search staff name or number…"
            value={searchStaff} onChange={e => setSearchStaff(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="violation_demerit">Violations only</SelectItem>
            <SelectItem value="reward_redemption">Rewards only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loadingLogs ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Fine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map(log => {
                  const effectivePoints = log.custom_points ?? log.action?.default_points ?? 0
                  const effectiveFine   = log.custom_fine   ?? log.action?.default_fine   ?? 0
                  const isDemerit = log.action?.action_type === "violation_demerit"
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{logStaffName(log)}</p>
                          <p className="text-xs text-muted-foreground">{log.staff?.employee_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{log.action?.action_name_en}</p>
                          <p className="text-xs text-muted-foreground text-right" dir="rtl">
                            {log.action?.action_name_ar}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={isDemerit ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                          {isDemerit ? (
                            <><TrendingDown className="mr-1 h-3 w-3 inline" />Violation</>
                          ) : (
                            <><TrendingUp className="mr-1 h-3 w-3 inline" />Reward</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ESCALATION_COLORS[log.action?.escalation_stage || "none"]}>
                          {ESCALATION_LABELS[log.action?.escalation_stage || "none"]}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-center font-semibold ${isDemerit ? "text-red-600" : "text-green-600"}`}>
                        {isDemerit ? effectivePoints : `+${effectivePoints}`}
                      </TableCell>
                      <TableCell className="text-center">
                        {effectiveFine !== 0 ? (
                          <span className={isDemerit ? "text-red-600" : "text-green-600"}>
                            {isDemerit ? "-" : "+"}{Math.abs(effectiveFine)}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {log.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {log.letter_generated && (
                            <Button
                              variant="ghost" size="icon"
                              title="Disciplinary letter ready"
                              onClick={() => router.push(`/admin/performance/letter/${log.id}`)}
                            >
                              <FileText className="h-4 w-4 text-orange-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(log.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {displayed.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No incidents found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Record Incident Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Staff picker */}
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9" placeholder="Search by name or employee number…"
                  value={staffSearch}
                  onChange={e => { setStaffSearch(e.target.value); setSelectedStaff(null) }}
                />
              </div>
              {staffSearch && !selectedStaff && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {staffLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                  ) : staffList.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No staff found</div>
                  ) : staffList.map((s: Staff) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => { setSelectedStaff(s); setStaffSearch(staffName(s)) }}
                    >
                      <span className="font-medium">{staffName(s)}</span>
                      <span className="text-muted-foreground ml-2">#{s.employee_number}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedStaff && (
                <p className="text-sm text-green-700">
                  Selected: <strong>{staffName(selectedStaff)}</strong> ({selectedStaff.employee_number})
                </p>
              )}
            </div>

            {/* Action picker */}
            <div className="space-y-1">
              <Label>Action *</Label>
              <Select value={selectedAction?.id || ""} onValueChange={handleActionSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an action from catalog…" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.filter(a => a.action_type === "violation_demerit").length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-red-600 uppercase">Violations</div>
                      {catalog.filter(a => a.action_type === "violation_demerit").map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.action_name_en} ({a.default_points} pts)
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {catalog.filter(a => a.action_type === "reward_redemption").length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-green-600 uppercase mt-1">Rewards</div>
                      {catalog.filter(a => a.action_type === "reward_redemption").map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.action_name_en} (+{a.default_points} pts)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedAction && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>
                  Type: <Badge className={selectedAction.action_type === "violation_demerit" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                    {selectedAction.action_type === "violation_demerit" ? "Violation" : "Reward"}
                  </Badge>
                </p>
                <p>
                  Escalation: <Badge className={ESCALATION_COLORS[selectedAction.escalation_stage]}>
                    {ESCALATION_LABELS[selectedAction.escalation_stage]}
                  </Badge>
                  {["written_warning", "final_warning"].includes(selectedAction.escalation_stage) && (
                    <span className="ml-2 text-orange-600 text-xs">Disciplinary letter will be generated</span>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Points Override</Label>
                <Input
                  type="number"
                  value={customPoints}
                  onChange={e => setCustomPoints(e.target.value)}
                  placeholder="Leave as catalog default"
                />
              </div>
              <div className="space-y-1">
                <Label>Fine Override</Label>
                <Input
                  type="number" min="0"
                  value={customFine}
                  onChange={e => setCustomFine(e.target.value)}
                  placeholder="Leave as catalog default"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this incident…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecord} disabled={saving || !selectedStaff || !selectedAction}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
