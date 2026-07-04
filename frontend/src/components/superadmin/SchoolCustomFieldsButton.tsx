'use client'

import * as React from 'react'
import { ListPlus, Loader2, Plus, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  customFieldsApi,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CampusScope,
  type BranchSchool,
} from '@/lib/api/custom-fields'

interface SchoolCustomFieldsButtonProps {
  schoolId: string
  schoolName: string
}

const FIELD_TYPES: CustomFieldType[] = ['text', 'long-text', 'number', 'date', 'checkbox', 'select', 'multi-select', 'file']
const OPTIONS_TYPES: CustomFieldType[] = ['select', 'multi-select']

interface FieldFormState {
  label: string
  type: CustomFieldType
  options_text: string
  required: boolean
  campus_scope: CampusScope
  applicable_school_ids: string[]
}

const emptyForm = (): FieldFormState => ({
  label: '',
  type: 'text',
  options_text: '',
  required: false,
  campus_scope: 'all_campuses',
  applicable_school_ids: [],
})

export function SchoolCustomFieldsButton({ schoolId, schoolName }: SchoolCustomFieldsButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [fields, setFields] = React.useState<CustomFieldDefinition[]>([])
  const [branchSchools, setBranchSchools] = React.useState<BranchSchool[]>([])

  const [showForm, setShowForm] = React.useState(false)
  const [editingField, setEditingField] = React.useState<CustomFieldDefinition | null>(null)
  const [form, setForm] = React.useState<FieldFormState>(emptyForm())

  const loadFields = React.useCallback(async () => {
    setLoading(true)
    try {
      const [fieldsRes, branchesRes] = await Promise.all([
        customFieldsApi.getFieldDefinitions('school', schoolId),
        customFieldsApi.getBranchSchools(),
      ])
      if (fieldsRes.success) setFields(fieldsRes.data ?? [])
      if (branchesRes.success) setBranchSchools(branchesRes.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  const handleOpen = () => {
    setOpen(true)
    loadFields()
  }

  function openAdd() {
    setEditingField(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(field: CustomFieldDefinition) {
    setEditingField(field)
    setForm({
      label: field.label,
      type: field.type,
      options_text: (field.options ?? []).join('\n'),
      required: field.required,
      campus_scope: field.campus_scope,
      applicable_school_ids: field.applicable_school_ids ?? [],
    })
    setShowForm(true)
  }

  function buildOptions(): string[] | undefined {
    if (!OPTIONS_TYPES.includes(form.type)) return undefined
    return form.options_text.split('\n').map((l) => l.trim()).filter(Boolean)
  }

  async function handleSaveField() {
    if (!form.label.trim()) {
      toast.error('Field label is required')
      return
    }
    setSaving(true)
    try {
      if (editingField) {
        const res = await customFieldsApi.updateFieldDefinition(editingField.id, {
          label: form.label.trim(),
          type: form.type,
          options: buildOptions(),
          required: form.required,
          campus_scope: form.campus_scope,
          applicable_school_ids: form.campus_scope === 'selected_campuses' ? form.applicable_school_ids : undefined,
        }, schoolId)
        if (!res.success) { toast.error(res.error ?? 'Failed to update field'); return }
        toast.success('Field updated')
      } else {
        const res = await customFieldsApi.createFieldDefinition({
          entity_type: 'school',
          category_id: 'school_details',
          category_name: 'School Details',
          label: form.label.trim(),
          type: form.type,
          options: buildOptions(),
          required: form.required,
          campus_scope: form.campus_scope,
          applicable_school_ids: form.campus_scope === 'selected_campuses' ? form.applicable_school_ids : undefined,
        }, schoolId)
        if (!res.success) { toast.error(res.error ?? 'Failed to create field'); return }
        toast.success('Field added')
      }
      setShowForm(false)
      loadFields()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(field: CustomFieldDefinition) {
    const res = await customFieldsApi.deleteFieldDefinition(field.id, schoolId)
    if (!res.success) { toast.error(res.error ?? 'Failed to delete field'); return }
    toast.success('Field deleted')
    setFields((prev) => prev.filter((f) => f.id !== field.id))
  }

  function toggleBranchSchool(id: string) {
    setForm((f) => ({
      ...f,
      applicable_school_ids: f.applicable_school_ids.includes(id)
        ? f.applicable_school_ids.filter((x) => x !== id)
        : [...f.applicable_school_ids, id],
    }))
  }

  return (
    <>
      <Button
        size="sm"
        className="w-full gradient-blue text-white hover:shadow-md transition-all border-0 h-8"
        onClick={handleOpen}
      >
        <ListPlus className="h-3.5 w-3.5 me-1.5" />
        Custom Fields
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>School Custom Fields — {schoolName}</DialogTitle>
            <DialogDescription>
              Define custom fields that will show up on this school's "School Details" page for the campus admin to fill in.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : showForm ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Field Label</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. License Number"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Field Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CustomFieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {OPTIONS_TYPES.includes(form.type) && (
                <div className="space-y-1.5">
                  <Label>Options <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.options_text}
                    onChange={(e) => setForm({ ...form, options_text: e.target.value })}
                    placeholder={'Option 1\nOption 2'}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch checked={form.required} onCheckedChange={(c) => setForm({ ...form, required: c })} />
                <Label>Required</Label>
              </div>

              <div className="space-y-1.5">
                <Label>Campus Scope</Label>
                <Select value={form.campus_scope} onValueChange={(v) => setForm({ ...form, campus_scope: v as CampusScope })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_campus">Only this exact row (not its branch campuses)</SelectItem>
                    <SelectItem value="all_campuses">All campuses (branches) — recommended</SelectItem>
                    <SelectItem value="selected_campuses">Selected campuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.campus_scope === 'selected_campuses' && (
                <div className="space-y-1.5">
                  <Label>Choose Campuses</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {branchSchools.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No branch campuses found.</p>
                    ) : (
                      branchSchools.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 text-sm px-1 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.applicable_school_ids.includes(b.id)}
                            onChange={() => toggleBranchSchool(b.id)}
                          />
                          {b.name}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSaveField} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingField ? 'Save Changes' : 'Add Field'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex justify-end">
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No custom fields defined for this school yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.id} className="flex items-center gap-3 p-3 border rounded-md">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{field.label}</span>
                          <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                          <Badge variant="outline" className="text-xs">{field.campus_scope.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(field)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(field)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
