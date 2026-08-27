"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Loader2, Plus, Building2, UserCog, X, Pencil, Ban, RotateCcw, Trash2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { getCampuses, type Campus } from "@/lib/api/setup-status"
import {
  listInspectors, createInspector, updateInspector, deactivateInspector, reactivateInspector,
  deleteInspectorPermanently, listAssignmentsForInspector, assignCampusToInspector, revokeInspectorCampus,
  type InspectorProfile, type InspectorAssignment,
} from "@/lib/api/inspectors"

export function InspectorAssignmentsManager() {
  const t = useTranslations("inspections.assignments")
  const { profile } = useAuth()

  const [inspectors, setInspectors] = useState<InspectorProfile[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<InspectorAssignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  // Create inspector dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" })

  // Assign campus dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignCampusId, setAssignCampusId] = useState<string>("")

  // Edit inspector dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTargetId, setEditTargetId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "" })

  // Deactivate/reactivate in-flight tracking (per-row, so only that row's button spins)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Permanent delete confirmation — this page is already admin/super_admin-only
  // (see admin/layout.tsx's RoleGuard), so no further role gate is needed here.
  const [deleteTarget, setDeleteTarget] = useState<InspectorProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadInspectors = () => {
    setLoading(true)
    listInspectors().then((res) => {
      if (res.error) toast.error(res.error)
      setInspectors(res.data || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadInspectors()
    getCampuses().then(setCampuses).catch(() => {})
  }, [])

  const loadAssignments = (inspectorId: string) => {
    setAssignmentsLoading(true)
    listAssignmentsForInspector(inspectorId).then((res) => {
      if (res.error) toast.error(res.error)
      setAssignments(res.data || [])
      setAssignmentsLoading(false)
    })
  }

  const selectInspector = (id: string) => {
    setSelectedInspectorId(id)
    loadAssignments(id)
  }

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) return
    if (!profile?.school_id) return
    setCreating(true)
    try {
      const res = await createInspector({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        home_school_id: profile.school_id,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("msg_created"))
        setCreateOpen(false)
        setForm({ first_name: "", last_name: "", email: "", phone: "" })
        loadInspectors()
      }
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (i: InspectorProfile) => {
    setEditTargetId(i.id)
    setEditForm({ first_name: i.first_name, last_name: i.last_name, phone: i.phone || "" })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editTargetId || !editForm.first_name.trim() || !editForm.last_name.trim()) return
    setEditing(true)
    try {
      const res = await updateInspector(editTargetId, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        phone: editForm.phone.trim() || null,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("msg_updated"))
        setEditOpen(false)
        setEditTargetId(null)
        loadInspectors()
      }
    } finally {
      setEditing(false)
    }
  }

  const handleToggleActive = async (i: InspectorProfile) => {
    setTogglingId(i.id)
    try {
      const res = i.is_active ? await deactivateInspector(i.id) : await reactivateInspector(i.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(i.is_active ? t("msg_deactivated") : t("msg_reactivated"))
        loadInspectors()
      }
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await deleteInspectorPermanently(deleteTarget.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("msg_deleted"))
        if (selectedInspectorId === deleteTarget.id) {
          setSelectedInspectorId(null)
          setAssignments([])
        }
        setDeleteTarget(null)
        loadInspectors()
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedInspectorId || !assignCampusId) return
    setAssigning(true)
    try {
      const res = await assignCampusToInspector({
        inspector_profile_id: selectedInspectorId,
        school_id: assignCampusId,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t("msg_assigned"))
        setAssignOpen(false)
        setAssignCampusId("")
        loadAssignments(selectedInspectorId)
      }
    } finally {
      setAssigning(false)
    }
  }

  const handleRevoke = async (assignmentId: string) => {
    if (!selectedInspectorId) return
    const res = await revokeInspectorCampus(assignmentId)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t("msg_revoked"))
      loadAssignments(selectedInspectorId)
    }
  }

  const selectedInspector = inspectors.find((i) => i.id === selectedInspectorId) || null
  const assignedCampusIds = new Set(assignments.map((a) => a.school_id))
  const availableCampuses = campuses.filter((c) => !assignedCampusIds.has(c.id))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-5 w-5 text-[#022172]" />
              {t("inspectors_title")}
            </CardTitle>
            <CardDescription>{t("inspectors_subtitle")}</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                {t("btn_new_inspector")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog_create_title")}</DialogTitle>
                <DialogDescription>{t("dialog_create_desc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("field_first_name")}</Label>
                    <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("field_last_name")}</Label>
                    <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("field_email")}</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("field_phone")}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !form.first_name.trim() || !form.last_name.trim() || !form.email.trim()}
                  className="gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t("btn_create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : inspectors.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">{t("no_inspectors")}</p>
          ) : (
            <>
            <div className="space-y-1.5">
              {inspectors.map((i) => (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectInspector(i.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectInspector(i.id) }}
                  className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-md border text-left transition-colors cursor-pointer ${
                    selectedInspectorId === i.id ? "border-[#022172] bg-[#022172]/5" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{i.first_name} {i.last_name}</div>
                    <div className="text-xs text-gray-500 truncate">{i.email}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!i.is_active && <Badge variant="outline" className="text-[10px] mr-1">{t("inactive_badge")}</Badge>}
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); openEdit(i) }}
                      title={t("btn_edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className={`h-7 w-7 ${i.is_active ? "text-destructive" : "text-green-600"}`}
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(i) }}
                      disabled={togglingId === i.id}
                      title={i.is_active ? t("btn_deactivate") : t("btn_reactivate")}
                    >
                      {togglingId === i.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : i.is_active ? (
                        <Ban className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(i) }}
                      title={t("btn_delete_permanently")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("dialog_edit_title")}</DialogTitle>
                  <DialogDescription>{t("dialog_edit_desc")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t("field_first_name")}</Label>
                      <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("field_last_name")}</Label>
                      <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("field_phone")}</Label>
                    <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleEditSave}
                    disabled={editing || !editForm.first_name.trim() || !editForm.last_name.trim()}
                    className="gap-2"
                  >
                    {editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    {t("btn_save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("dialog_delete_title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteTarget && t("dialog_delete_desc", { name: `${deleteTarget.first_name} ${deleteTarget.last_name}` })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{t("btn_cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDeleteConfirm() }}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {t("btn_delete_permanently")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-[#022172]" />
              {t("assignments_title")}
            </CardTitle>
            <CardDescription>
              {selectedInspector
                ? t("assignments_subtitle_for", { name: `${selectedInspector.first_name} ${selectedInspector.last_name}` })
                : t("assignments_subtitle_empty")}
            </CardDescription>
          </div>
          {selectedInspectorId && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" disabled={availableCampuses.length === 0}>
                  <Plus className="h-4 w-4" />
                  {t("btn_assign_campus")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("dialog_assign_title")}</DialogTitle>
                  <DialogDescription>{t("dialog_assign_desc")}</DialogDescription>
                </DialogHeader>
                <div className="py-2 space-y-1.5">
                  <Label>{t("field_campus")}</Label>
                  <Select value={assignCampusId} onValueChange={setAssignCampusId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("field_campus_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCampuses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={handleAssign} disabled={assigning || !assignCampusId} className="gap-2">
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {t("btn_assign")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {!selectedInspectorId ? (
            <p className="text-sm text-gray-500 py-6">{t("select_inspector_prompt")}</p>
          ) : assignmentsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">{t("no_assignments")}</p>
          ) : (
            <div className="space-y-1.5">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-md border">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{a.school?.name || a.school_id}</span>
                    {a.subject && <Badge variant="outline" className="text-[10px]">{a.subject.name}</Badge>}
                    {a.grade_level && <Badge variant="outline" className="text-[10px]">{a.grade_level.name}</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRevoke(a.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
