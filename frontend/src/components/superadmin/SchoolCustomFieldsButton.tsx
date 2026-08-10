'use client'

import * as React from 'react'
import { ListPlus, Loader2, Plus, Trash2, Pencil, GripVertical, Save } from 'lucide-react'
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
import { getAllSchoolsData } from '@/lib/api/schools'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SchoolCustomFieldsButtonProps {
  schoolId: string
  schoolName: string
  // Whether the caller is a platform super admin. Non-super-admins (a
  // school's own admin, managing their own campus's tabs/fields) only get
  // "this campus" / "all campuses" scoping — cross-school scoping stays
  // super-admin-only, enforced again server-side.
  isSuperAdmin?: boolean
  // Called after a field is created, edited, reordered, or deleted so a
  // parent page that also renders these fields (e.g. Campus Details) can refresh.
  onFieldsChanged?: () => void
}

const FIELD_TYPES: CustomFieldType[] = ['text', 'long-text', 'number', 'date', 'checkbox', 'select', 'multi-select', 'file']
const OPTIONS_TYPES: CustomFieldType[] = ['select', 'multi-select']
const DEFAULT_TAB_ID = 'school_details'
const DEFAULT_TAB_NAME = 'School Details'
const NEW_TAB_VALUE = '__new_tab__'

function slugifyTabName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `tab_${Date.now()}`
}

interface FieldFormState {
  label: string
  type: CustomFieldType
  options_text: string
  required: boolean
  campus_scope: CampusScope
  applicable_school_ids: string[]
  category_id: string
  category_name: string
}

const emptyForm = (categoryId: string, categoryName: string): FieldFormState => ({
  label: '',
  type: 'text',
  options_text: '',
  required: false,
  campus_scope: 'all_campuses',
  applicable_school_ids: [],
  category_id: categoryId,
  category_name: categoryName,
})

export function SchoolCustomFieldsButton({ schoolId, schoolName, isSuperAdmin, onFieldsChanged }: SchoolCustomFieldsButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [savingOrder, setSavingOrder] = React.useState(false)
  const [fields, setFields] = React.useState<CustomFieldDefinition[]>([])
  const [allSchools, setAllSchools] = React.useState<BranchSchool[]>([])
  const [activeTab, setActiveTab] = React.useState<string>(DEFAULT_TAB_ID)

  const [showForm, setShowForm] = React.useState(false)
  const [editingField, setEditingField] = React.useState<CustomFieldDefinition | null>(null)
  const [form, setForm] = React.useState<FieldFormState>(emptyForm(DEFAULT_TAB_ID, DEFAULT_TAB_NAME))
  const [newTabName, setNewTabName] = React.useState('')

  const loadFields = React.useCallback(async () => {
    setLoading(true)
    try {
      const [fieldsRes, allSchoolsRes] = await Promise.all([
        customFieldsApi.getFieldDefinitions('school', schoolId),
        getAllSchoolsData(),
      ])
      if (fieldsRes.success) setFields(fieldsRes.data ?? [])
      if (allSchoolsRes.success) setAllSchools((allSchoolsRes.data ?? []).map((s) => ({ id: s.id, name: s.name })))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  const handleOpen = () => {
    setOpen(true)
    loadFields()
  }

  // Every distinct category among this school's fields is a "tab". Always
  // include the default tab so there's somewhere to add the very first field.
  const tabs = React.useMemo(() => {
    const map = new Map<string, string>([[DEFAULT_TAB_ID, DEFAULT_TAB_NAME]])
    fields.forEach((f) => map.set(f.category_id, f.category_name))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [fields])

  React.useEffect(() => {
    if (!tabs.find((t) => t.id === activeTab)) setActiveTab(tabs[0]?.id ?? DEFAULT_TAB_ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  const [tabOrder, setTabOrder] = React.useState<CustomFieldDefinition[]>([])
  React.useEffect(() => {
    setTabOrder(fields.filter((f) => f.category_id === activeTab).sort((a, b) => a.sort_order - b.sort_order))
  }, [fields, activeTab])

  function openAdd() {
    setEditingField(null)
    const tab = tabs.find((t) => t.id === activeTab)
    setForm(emptyForm(tab?.id ?? DEFAULT_TAB_ID, tab?.name ?? DEFAULT_TAB_NAME))
    setNewTabName('')
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
      category_id: field.category_id,
      category_name: field.category_name,
    })
    setNewTabName('')
    setShowForm(true)
  }

  function buildOptions(): string[] | undefined {
    if (!OPTIONS_TYPES.includes(form.type)) return undefined
    return form.options_text.split('\n').map((l) => l.trim()).filter(Boolean)
  }

  function handleTabSelect(value: string) {
    if (value === NEW_TAB_VALUE) {
      setForm((f) => ({ ...f, category_id: '', category_name: '' }))
      return
    }
    const tab = tabs.find((t) => t.id === value)
    if (tab) setForm((f) => ({ ...f, category_id: tab.id, category_name: tab.name }))
  }

  function handleNewTabNameChange(name: string) {
    setNewTabName(name)
    setForm((f) => ({ ...f, category_id: slugifyTabName(name), category_name: name.trim() }))
  }

  const isCreatingNewTab = !tabs.find((t) => t.id === form.category_id)

  async function handleSaveField() {
    if (!form.label.trim()) {
      toast.error('Field label is required')
      return
    }
    if (!form.category_name.trim()) {
      toast.error('Tab name is required')
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
          category_id: form.category_id,
          category_name: form.category_name.trim(),
        }, schoolId)
        if (!res.success) { toast.error(res.error ?? 'Failed to update field'); return }
        toast.success('Field updated')
        onFieldsChanged?.()
      } else {
        const res = await customFieldsApi.createFieldDefinition({
          entity_type: 'school',
          category_id: form.category_id,
          category_name: form.category_name.trim(),
          label: form.label.trim(),
          type: form.type,
          options: buildOptions(),
          required: form.required,
          campus_scope: form.campus_scope,
          applicable_school_ids: form.campus_scope === 'selected_campuses' ? form.applicable_school_ids : undefined,
        }, schoolId)
        if (!res.success) { toast.error(res.error ?? 'Failed to create field'); return }
        toast.success('Field added')
        onFieldsChanged?.()
      }
      setActiveTab(form.category_id)
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
    onFieldsChanged?.()
  }

  function toggleBranchSchool(id: string) {
    setForm((f) => ({
      ...f,
      applicable_school_ids: f.applicable_school_ids.includes(id)
        ? f.applicable_school_ids.filter((x) => x !== id)
        : [...f.applicable_school_ids, id],
    }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setTabOrder((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  async function handleSaveOrder() {
    setSavingOrder(true)
    try {
      const res = await customFieldsApi.reorderFields(
        activeTab,
        tabOrder.map((f, idx) => ({ id: f.id, sort_order: idx + 1 })),
        schoolId
      )
      if (!res.success) { toast.error(res.error ?? 'Failed to save order'); return }
      toast.success('Field order saved')
      onFieldsChanged?.()
      loadFields()
    } finally {
      setSavingOrder(false)
    }
  }

  // Cross-school scoping is super-admin-only (enforced again server-side) —
  // a school's own admin only manages fields within their own campus family.
  const scopeOptions: { value: CampusScope; label: string }[] = isSuperAdmin
    ? [
        { value: 'this_campus', label: 'Only this exact row (not its branch campuses)' },
        { value: 'all_campuses', label: 'All campuses (branches) — recommended' },
        { value: 'selected_campuses', label: 'Selected schools' },
        { value: 'all_schools', label: 'All schools (every school in the system)' },
      ]
    : [
        { value: 'this_campus', label: 'Only this campus' },
        { value: 'all_campuses', label: 'This campus and its branches' },
      ]

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
              Define custom fields, grouped into tabs, that will show up on this school's "Campus Details" page.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : showForm ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Tab</Label>
                <Select
                  value={isCreatingNewTab ? NEW_TAB_VALUE : form.category_id}
                  onValueChange={handleTabSelect}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tabs.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    <SelectItem value={NEW_TAB_VALUE}>+ Add new tab…</SelectItem>
                  </SelectContent>
                </Select>
                {isCreatingNewTab && (
                  <Input
                    value={newTabName}
                    onChange={(e) => handleNewTabNameChange(e.target.value)}
                    placeholder="e.g. Facilities"
                    className="mt-1.5"
                  />
                )}
              </div>

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
                    {scopeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.campus_scope === 'selected_campuses' && (
                <div className="space-y-1.5">
                  <Label>Choose Schools</Label>
                  <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                    {allSchools.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1">No schools found.</p>
                    ) : (
                      allSchools.map((b) => (
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
              {tabs.length > 1 && (
                <div className="flex flex-wrap gap-1.5 border-b pb-2">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        activeTab === t.id
                          ? 'bg-gray-900 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center gap-2">
                {tabOrder.length > 1 ? (
                  <Button size="sm" variant="outline" onClick={handleSaveOrder} disabled={savingOrder}>
                    {savingOrder ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save Order
                  </Button>
                ) : <span />}
                <Button size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Field
                </Button>
              </div>

              {tabOrder.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No custom fields defined in this tab yet.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={tabOrder.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {tabOrder.map((field) => (
                        <SortableFieldRow
                          key={field.id}
                          field={field}
                          onEdit={() => openEdit(field)}
                          onDelete={() => handleDelete(field)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SortableFieldRow({
  field,
  onEdit,
  onDelete,
}: {
  field: CustomFieldDefinition
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 border rounded-md bg-background">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{field.label}</span>
          <Badge variant="outline" className="text-xs">{field.type}</Badge>
          {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
          <Badge variant="outline" className="text-xs">{field.campus_scope.replace('_', ' ')}</Badge>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
