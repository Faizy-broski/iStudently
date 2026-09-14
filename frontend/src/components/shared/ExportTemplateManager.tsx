'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { GripVertical, Trash2, Star, Loader2, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useExportTemplates } from '@/hooks/useExportTemplates'
import type { ExportColumn } from '@/lib/utils/tableExport'
import type { ExportTemplateColumn } from '@/lib/api/export-templates'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DraftColumn extends ExportTemplateColumn {}

function buildDraft<T>(columns: ExportColumn<T>[], from?: ExportTemplateColumn[]): DraftColumn[] {
  if (!from || from.length === 0) {
    return columns.map((c, i) => ({ key: c.key, label: c.label, label_ar: c.label_ar ?? '', visible: true, order: i }))
  }
  // Start from the saved template's order, then append any newer columns
  // (added to the screen since the template was saved) at the end, visible.
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const draft: DraftColumn[] = from
    .filter((c) => byKey.has(c.key))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c }))
  const seen = new Set(draft.map((c) => c.key))
  columns.forEach((c) => {
    if (!seen.has(c.key)) draft.push({ key: c.key, label: c.label, label_ar: c.label_ar ?? '', visible: true, order: draft.length })
  })
  return draft
}

interface Props<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportKey: string
  columns: ExportColumn<T>[]
}

/**
 * Lightweight column picker/reorder/label editor for a report's export
 * templates — deliberately NOT the certificate/ID-card drag-drop canvas
 * builder, since a tabular export just needs "which columns, what order,
 * what label", not free-form x/y positioning.
 */
export function ExportTemplateManager<T>({ open, onOpenChange, reportKey, columns }: Props<T>) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const { templates, defaultTemplate, createTemplate, updateTemplate, deleteTemplate, setDefaultTemplate } = useExportTemplates(reportKey)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<DraftColumn[]>(() => buildDraft(columns))
  const [name, setName] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  // Load the default template (or a blank draft) whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    const initial = defaultTemplate ?? null
    setSelectedId(initial?.id ?? null)
    setName(initial?.name ?? '')
    setDraft(buildDraft(columns, initial?.columns))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTemplate?.id])

  const selectTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setSelectedId(id)
    setName(tpl.name)
    setDraft(buildDraft(columns, tpl.columns))
  }

  const startNew = () => {
    setSelectedId(null)
    setName('')
    setDraft(buildDraft(columns))
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraft((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id)
      const newIndex = items.findIndex((i) => i.key === over.id)
      return arrayMove(items, oldIndex, newIndex).map((c, i) => ({ ...c, order: i }))
    })
  }

  const toggleVisible = (key: string, visible: boolean) => {
    setDraft((items) => items.map((c) => (c.key === key ? { ...c, visible } : c)))
  }

  const updateLabel = (key: string, field: 'label' | 'label_ar', value: string) => {
    setDraft((items) => items.map((c) => (c.key === key ? { ...c, [field]: value } : c)))
  }

  const handleSave = async (asDefault: boolean) => {
    if (!name.trim()) {
      toast.error(isAr ? 'الرجاء إدخال اسم للقالب' : 'Please enter a template name')
      return
    }
    setSaving(true)
    try {
      const payload = { name: name.trim(), columns: draft, is_default: asDefault }
      if (selectedId) {
        await updateTemplate(selectedId, payload)
      } else {
        const created = await createTemplate({ report_key: reportKey, ...payload })
        if (created) setSelectedId(created.id)
      }
      toast.success(isAr ? 'تم حفظ القالب' : 'Template saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل حفظ القالب' : 'Failed to save template'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await deleteTemplate(selectedId)
      toast.success(isAr ? 'تم حذف القالب' : 'Template deleted')
      startNew()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (isAr ? 'فشل حذف القالب' : 'Failed to delete template'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{isAr ? 'إدارة قوالب التصدير' : 'Manage Export Templates'}</DialogTitle>
        </DialogHeader>

        {templates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t.id)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full border flex items-center gap-1',
                  selectedId === t.id ? 'border-[#022172] bg-[#022172]/10 text-[#022172]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {t.is_default && <Star className="h-3 w-3 fill-current" />}
                {t.name}
              </button>
            ))}
            <button
              type="button"
              onClick={startNew}
              className="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {isAr ? 'جديد' : 'New'}
            </button>
          </div>
        )}

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isAr ? 'اسم القالب' : 'Template name'}
        />

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs font-semibold text-gray-500">
            <div className="col-span-1"></div>
            <div className="col-span-1"></div>
            <div className="col-span-5">{isAr ? 'العمود' : 'Column'}</div>
            <div className="col-span-5">{isAr ? 'التسمية' : 'Label'}</div>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={draft.map((c) => c.key)} strategy={verticalListSortingStrategy}>
              {draft.map((col) => (
                <ColumnRow key={col.key} col={col} onToggle={toggleVisible} onLabelChange={updateLabel} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {selectedId && (
            <Button variant="outline" className="text-red-600 border-red-300" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 me-1" />
              {isAr ? 'حذف' : 'Delete'}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
            {isAr ? 'حفظ' : 'Save'}
          </Button>
          <Button className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white" onClick={() => handleSave(true)} disabled={saving}>
            <Star className="h-4 w-4 me-1" />
            {isAr ? 'حفظ كافتراضي' : 'Save as default'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ColumnRow({
  col,
  onToggle,
  onLabelChange,
}: {
  col: DraftColumn
  onToggle: (key: string, visible: boolean) => void
  onLabelChange: (key: string, field: 'label' | 'label_ar', value: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('grid grid-cols-12 gap-1 px-2 py-1.5 border-t items-center text-xs', !col.visible && 'opacity-50')}
    >
      <div className="col-span-1 flex items-center">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>
      <div className="col-span-1 flex justify-center">
        <Checkbox checked={col.visible} onCheckedChange={(checked) => onToggle(col.key, checked as boolean)} />
      </div>
      <div className="col-span-5 truncate font-medium text-gray-600 dark:text-gray-300">{col.key}</div>
      <div className="col-span-5 space-y-1">
        <Input
          value={col.label}
          onChange={(e) => onLabelChange(col.key, 'label', e.target.value)}
          className="h-6 text-xs"
        />
        <Input
          value={col.label_ar || ''}
          onChange={(e) => onLabelChange(col.key, 'label_ar', e.target.value)}
          placeholder="Arabic label (optional)"
          dir="rtl"
          className="h-6 text-xs"
        />
      </div>
    </div>
  )
}
