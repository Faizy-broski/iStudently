"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Plus, Trash2, Edit2, Loader2, ArrowLeft, AlertCircle, BarChart3 } from "lucide-react"
import {
  getCatalog, createAction, updateAction, deleteAction,
  type PerformanceActionLookup,
} from "@/lib/api/performance"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESCALATION_LABELS: Record<string, string> = {
  none:            "None",
  verbal_alert:    "Verbal Alert",
  written_warning: "Written Warning",
  final_warning:   "Final Warning",
}
const ESCALATION_COLORS: Record<string, string> = {
  none:            "bg-gray-100 text-gray-700",
  verbal_alert:    "bg-yellow-100 text-yellow-700",
  written_warning: "bg-orange-100 text-orange-700",
  final_warning:   "bg-red-100 text-red-800",
}

const EMPTY_FORM: Partial<PerformanceActionLookup> = {
  action_name_ar: "", action_name_en: "",
  action_type: "violation_demerit", escalation_stage: "none",
  default_points: 0, default_fine: 0, is_active: true, sort_order: 0,
}

export default function PerformanceCatalogPage() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<PerformanceActionLookup[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PerformanceActionLookup | null>(null)
  const [form, setForm] = useState<Partial<PerformanceActionLookup>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setCatalog(await getCatalog())
    } catch {
      toast.error("Failed to load catalog")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (row: PerformanceActionLookup) => {
    setEditing(row)
    setForm({ ...row })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.action_name_ar || !form.action_name_en || !form.action_type) {
      toast.error("Arabic name, English name, and type are required")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateAction(editing.id, form)
        toast.success("Action updated")
      } else {
        await createAction(form)
        toast.success("Action created")
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this action? This cannot be undone.")) return
    try {
      await deleteAction(id)
      toast.success("Deleted")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleToggle = async (row: PerformanceActionLookup) => {
    try {
      await updateAction(row.id, { is_active: !row.is_active })
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const violations = catalog.filter(a => a.action_type === "violation_demerit")
  const rewards    = catalog.filter(a => a.action_type === "reward_redemption")

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/performance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              Performance Catalog
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage violations (demerits) and rewards (redemptions)
            </p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Action
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Violations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                Violations / Demerits ({violations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arabic Name</TableHead>
                    <TableHead>English Name</TableHead>
                    <TableHead>Escalation</TableHead>
                    <TableHead className="text-center">Points</TableHead>
                    <TableHead className="text-center">Fine</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-right" dir="rtl">{row.action_name_ar}</TableCell>
                      <TableCell>{row.action_name_en}</TableCell>
                      <TableCell>
                        <Badge className={ESCALATION_COLORS[row.escalation_stage]}>
                          {ESCALATION_LABELS[row.escalation_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-semibold">{row.default_points}</TableCell>
                      <TableCell className="text-center">{row.default_fine > 0 ? `${row.default_fine}` : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={row.is_active} onCheckedChange={() => handleToggle(row)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {violations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No violations defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rewards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <BarChart3 className="h-5 w-5" />
                Rewards / Redemptions ({rewards.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arabic Name</TableHead>
                    <TableHead>English Name</TableHead>
                    <TableHead>Escalation</TableHead>
                    <TableHead className="text-center">Points</TableHead>
                    <TableHead className="text-center">Bonus</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-right" dir="rtl">{row.action_name_ar}</TableCell>
                      <TableCell>{row.action_name_en}</TableCell>
                      <TableCell>
                        <Badge className={ESCALATION_COLORS[row.escalation_stage]}>
                          {ESCALATION_LABELS[row.escalation_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-green-600 font-semibold">+{row.default_points}</TableCell>
                      <TableCell className="text-center">{row.default_fine > 0 ? `+${row.default_fine}` : "—"}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={row.is_active} onCheckedChange={() => handleToggle(row)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rewards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No rewards defined
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Action" : "Add Action"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Arabic Name *</Label>
                <Input
                  dir="rtl" placeholder="الاسم بالعربية"
                  value={form.action_name_ar || ""}
                  onChange={e => setForm(f => ({ ...f, action_name_ar: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>English Name *</Label>
                <Input
                  placeholder="Action name in English"
                  value={form.action_name_en || ""}
                  onChange={e => setForm(f => ({ ...f, action_name_en: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={form.action_type} onValueChange={v => setForm(f => ({ ...f, action_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="violation_demerit">Violation / Demerit</SelectItem>
                    <SelectItem value="reward_redemption">Reward / Redemption</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Escalation Stage</Label>
                <Select value={form.escalation_stage} onValueChange={v => setForm(f => ({ ...f, escalation_stage: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="verbal_alert">Verbal Alert</SelectItem>
                    <SelectItem value="written_warning">Written Warning</SelectItem>
                    <SelectItem value="final_warning">Final Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Default Points</Label>
                <Input
                  type="number"
                  value={form.default_points ?? 0}
                  onChange={e => setForm(f => ({ ...f, default_points: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Negative for demerits</p>
              </div>
              <div className="space-y-1">
                <Label>Default Fine</Label>
                <Input
                  type="number" min="0"
                  value={form.default_fine ?? 0}
                  onChange={e => setForm(f => ({ ...f, default_fine: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Sort Order</Label>
                <Input
                  type="number" min="0"
                  value={form.sort_order ?? 0}
                  onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
