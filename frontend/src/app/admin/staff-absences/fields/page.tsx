'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/staff-absences'
import type { StaffAbsenceField, AbsenceFieldType } from '@/lib/api/staff-absences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Settings2 } from 'lucide-react'

const FIELD_TYPE_LABELS: Record<AbsenceFieldType, string> = {
  text: 'Text',
  numeric: 'Number',
  date: 'Date',
  textarea: 'Long Text',
  radio: 'Checkbox (Yes/No)',
  select: 'Pull-Down',
  autos: 'Auto Pull-Down',
  exports: 'Export Pull-Down',
  multiple: 'Select Multiple',
  files: 'Files',
}

const TYPES_WITH_OPTIONS: AbsenceFieldType[] = ['select', 'autos', 'exports', 'multiple']

const emptyForm = {
  title: '',
  type: 'text' as AbsenceFieldType,
  select_options: '',
  default_selection: '',
  sort_order: '',
  required: false,
}

export default function AbsenceFieldsPage() {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const { data, isLoading, mutate } = useSWR(
    schoolId ? ['absence-fields', schoolId, campusId] : null,
    () => api.getAbsenceFields(schoolId, campusId)
  )

  const fields = data?.data || []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (field: StaffAbsenceField) => {
    setEditingId(field.id)
    setForm({
      title: field.title,
      type: field.type,
      select_options: field.select_options || '',
      default_selection: field.default_selection || '',
      sort_order: field.sort_order?.toString() || '',
      required: field.required,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Field name is required')
    if (!form.type) return toast.error('Field type is required')

    setSaving(true)
    const payload = {
      school_id: schoolId,
      campus_id: campusId,
      title: form.title.trim(),
      type: form.type,
      select_options: form.select_options || null,
      default_selection: form.default_selection || null,
      sort_order: form.sort_order ? parseInt(form.sort_order) : null,
      required: form.required,
    }

    const res = editingId
      ? await api.updateAbsenceField(editingId, payload)
      : await api.createAbsenceField(payload as any)

    setSaving(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(editingId ? 'Field updated' : 'Field created')
      mutate()
      setDialogOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const res = await api.deleteAbsenceField(deleteId)
    setDeleting(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Field deleted')
      mutate()
    }
    setDeleteId(null)
  }

  const showOptions = TYPES_WITH_OPTIONS.includes(form.type)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Absence Fields</h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Field
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : fields.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No custom fields yet.</p>
              <p className="text-sm mt-1">
                Add fields to capture additional absence information.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Field Name</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-center px-4 py-3 font-medium">Sort</th>
                  <th className="text-center px-4 py-3 font-medium">Required</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{field.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {FIELD_TYPE_LABELS[field.type] || field.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {field.sort_order ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {field.required ? (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(field)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(field.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Field' : 'New Absence Field'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Field Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Absence Type, Certificate…"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as AbsenceFieldType, select_options: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showOptions && (
              <div className="space-y-1.5">
                <Label>Options (one per line)</Label>
                <Textarea
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={4}
                  value={form.select_options}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, select_options: e.target.value }))
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Default Value</Label>
                <Input
                  placeholder="Optional"
                  value={form.default_selection}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_selection: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  placeholder="e.g. 1"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.required}
                onCheckedChange={(v) => setForm((f) => ({ ...f, required: v }))}
              />
              <Label>Required field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently delete the field and all its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
