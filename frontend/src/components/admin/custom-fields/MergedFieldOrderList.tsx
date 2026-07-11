'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GripVertical, Trash2, Save, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CustomField, CustomFieldType, CampusScope } from '@/types'
import { BranchSchool, customFieldsApi } from '@/lib/api/custom-fields'
import { type EntityType as FieldOrderEntityType } from '@/lib/utils/field-ordering'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { buildMergedItems, saveMergedOrder, type DefaultFieldMeta, type MergedFieldItem } from '@/lib/utils/custom-fields-reorder'

export interface MergedFieldOrderListLabels {
  th_label: string
  th_type: string
  th_scope: string
  th_options: string
  th_req: string
  btn_save_order: string
  field_label_placeholder: string
  field_options_placeholder: string
  scope_this: string
  scope_selected: string
  scope_all: string
  select_campuses: string
  no_fields: string
  default_badge: string
  type_text: string
  type_long_text: string
  type_number: string
  type_date: string
  type_checkbox: string
  type_select: string
  type_multi_select: string
  type_file: string
}

interface MergedFieldOrderListProps {
  entityType: FieldOrderEntityType
  categoryId: string
  campusId?: string
  defaultFields: DefaultFieldMeta[]
  customFields: CustomField[]
  branchSchools: BranchSchool[]
  labels: MergedFieldOrderListLabels
  translateDefaultLabel?: (label: string) => string
  onUpdateField: (fieldId: string, updates: Partial<CustomField>) => void
  onRemoveField: (fieldId: string) => void
  toggleCampusSelection: (fieldId: string, schoolId: string, checked: boolean) => void
  // Called after a successful order save so the page can refresh its
  // default-field-order cache (savedDefaultOrders / defaultFieldsByCategory).
  onOrderSaved: () => void
  // Toggle the required status of a default (built-in) field. Omitted for
  // entity types that haven't been wired up to this yet.
  onDefaultRequiredToggle?: (item: Extract<MergedFieldItem, { kind: 'default' }>, checked: boolean) => void
}

export function MergedFieldOrderList({
  entityType,
  categoryId,
  campusId,
  defaultFields,
  customFields,
  branchSchools,
  labels,
  translateDefaultLabel,
  onUpdateField,
  onRemoveField,
  toggleCampusSelection,
  onOrderSaved,
  onDefaultRequiredToggle,
}: MergedFieldOrderListProps) {
  const [order, setOrder] = useState<MergedFieldItem[]>(() => buildMergedItems(defaultFields, customFields))
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  // Resync from props whenever the underlying data changes (label edits, new
  // fields added, saved order reloaded) — harmless since re-sorting by the
  // same sort_order values reproduces the same order unless it actually changed.
  useEffect(() => {
    setOrder(buildMergedItems(defaultFields, customFields))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFields, customFields])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id)
      const newIndex = items.findIndex((i) => i.key === over.id)
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  const handleSaveOrder = async () => {
    setIsSavingOrder(true)
    try {
      const result = await saveMergedOrder(entityType, categoryId, order, campusId)
      if (result.success) {
        toast.success(labels.btn_save_order)
        onOrderSaved()
      } else {
        toast.error(result.error || 'Failed to save order')
      }
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleRequiredToggle = async (field: CustomField, checked: boolean) => {
    onUpdateField(field.id, { required: checked })
    if (field.id.startsWith('field-')) return // not yet created — will save with the field itself
    try {
      const res = await customFieldsApi.updateFieldDefinition(field.id, { required: checked }, campusId)
      if (!res.success) {
        onUpdateField(field.id, { required: !checked })
        toast.error(`Failed to update "${field.label || 'field'}"`)
      }
    } catch {
      onUpdateField(field.id, { required: !checked })
      toast.error(`Failed to update "${field.label || 'field'}"`)
    }
  }

  if (order.length === 0) {
    return (
      <div className="text-center py-3 text-xs text-gray-400 dark:text-gray-500 border dark:border-gray-700 border-dashed rounded">
        {labels.no_fields}
      </div>
    )
  }

  return (
    <div className="border dark:border-gray-700 rounded-md overflow-hidden">
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-2 py-1">
        <div className="grid grid-cols-12 gap-1 flex-1 text-xs font-semibold text-gray-600 dark:text-gray-200">
          <div className="col-span-1"></div>
          <div className="col-span-3">{labels.th_label}</div>
          <div className="col-span-2">{labels.th_type}</div>
          <div className="col-span-2">{labels.th_scope}</div>
          <div className="col-span-2">{labels.th_options}</div>
          <div className="col-span-1">{labels.th_req}</div>
          <div className="col-span-1"></div>
        </div>
        <Button
          size="sm"
          onClick={handleSaveOrder}
          disabled={isSavingOrder}
          className="h-6 px-2 text-xs bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90 shrink-0 ml-2"
        >
          {isSavingOrder ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />}
          {labels.btn_save_order}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          {order.map((item) =>
            item.kind === 'default' ? (
              <DefaultFieldRow
                key={item.key}
                item={item}
                label={translateDefaultLabel ? translateDefaultLabel(item.label) : item.label}
                badgeText={labels.default_badge}
                onRequiredToggle={onDefaultRequiredToggle}
              />
            ) : (
              <CustomFieldRow
                key={item.key}
                item={item}
                branchSchools={branchSchools}
                labels={labels}
                onUpdateField={onUpdateField}
                onRemoveField={onRemoveField}
                toggleCampusSelection={toggleCampusSelection}
                onRequiredToggle={handleRequiredToggle}
              />
            )
          )}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function DefaultFieldRow({
  item,
  label,
  badgeText,
  onRequiredToggle,
}: {
  item: Extract<MergedFieldItem, { kind: 'default' }>
  label: string
  badgeText: string
  onRequiredToggle?: (item: Extract<MergedFieldItem, { kind: 'default' }>, checked: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-1 px-2 py-1 border-t dark:border-gray-700 items-center text-xs bg-blue-50/50 dark:bg-blue-900/10"
    >
      <div className="col-span-1 flex items-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>
      <div className="col-span-3 font-medium dark:text-gray-300">{label}</div>
      <div className="col-span-6">
        <Badge variant="secondary" className="text-[10px] h-4">{badgeText}</Badge>
      </div>
      <div className="col-span-1 flex justify-center">
        {onRequiredToggle && (
          <Checkbox
            checked={item.required || false}
            onCheckedChange={(checked) => onRequiredToggle(item, checked as boolean)}
          />
        )}
      </div>
      <div className="col-span-1"></div>
    </div>
  )
}

function CustomFieldRow({
  item,
  branchSchools,
  labels,
  onUpdateField,
  onRemoveField,
  toggleCampusSelection,
  onRequiredToggle,
}: {
  item: Extract<MergedFieldItem, { kind: 'custom' }>
  branchSchools: BranchSchool[]
  labels: MergedFieldOrderListLabels
  onUpdateField: (fieldId: string, updates: Partial<CustomField>) => void
  onRemoveField: (fieldId: string) => void
  toggleCampusSelection: (fieldId: string, schoolId: string, checked: boolean) => void
  onRequiredToggle: (field: CustomField, checked: boolean) => void
}) {
  const field = item.field
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-1 px-2 py-1 border-t dark:border-gray-700 items-center text-xs"
    >
      <div className="col-span-1 flex items-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>
      <div className="col-span-3">
        <Input
          value={field.label}
          onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
          placeholder={labels.field_label_placeholder}
          className="h-7 text-xs"
        />
      </div>
      <div className="col-span-2">
        <Select value={field.type} onValueChange={(v) => onUpdateField(field.id, { type: v as CustomFieldType })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text">{labels.type_text}</SelectItem>
            <SelectItem value="long-text">{labels.type_long_text}</SelectItem>
            <SelectItem value="number">{labels.type_number}</SelectItem>
            <SelectItem value="date">{labels.type_date}</SelectItem>
            <SelectItem value="checkbox">{labels.type_checkbox}</SelectItem>
            <SelectItem value="select">{labels.type_select}</SelectItem>
            <SelectItem value="multi-select">{labels.type_multi_select}</SelectItem>
            <SelectItem value="file">{labels.type_file}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 flex gap-1">
        <Select
          value={field.campus_scope || 'this_campus'}
          onValueChange={(v) =>
            onUpdateField(field.id, {
              campus_scope: v as CampusScope,
              applicable_school_ids: v === 'selected_campuses' ? field.applicable_school_ids || [] : [],
            })
          }
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_campus">{labels.scope_this}</SelectItem>
            {branchSchools.length > 0 && <SelectItem value="selected_campuses">{labels.scope_selected}</SelectItem>}
            <SelectItem value="all_campuses">{labels.scope_all}</SelectItem>
          </SelectContent>
        </Select>
        {field.campus_scope === 'selected_campuses' && branchSchools.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-1">
                <Building2 className="h-3 w-3" />
                <span className="text-[10px] ml-1 rtl:mr-1 rtl:ml-0">{field.applicable_school_ids?.length || 0}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <span className="text-xs font-semibold dark:text-gray-200">{labels.select_campuses}</span>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {branchSchools.map((school) => (
                    <label key={school.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded dark:text-gray-200">
                      <Checkbox
                        checked={field.applicable_school_ids?.includes(school.id) || false}
                        onCheckedChange={(checked) => toggleCampusSelection(field.id, school.id, checked as boolean)}
                      />
                      {school.name}
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="col-span-2">
        {field.type === 'select' || field.type === 'multi-select' ? (
          <Input
            defaultValue={field.options?.join(', ') || ''}
            onBlur={(e) => onUpdateField(field.id, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder={labels.field_options_placeholder}
            className="h-7 text-xs"
          />
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>
      <div className="col-span-1 flex justify-center">
        <Checkbox
          checked={field.required || false}
          onCheckedChange={(checked) => onRequiredToggle(field, checked as boolean)}
        />
      </div>
      <div className="col-span-1 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
          onClick={() => onRemoveField(field.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
