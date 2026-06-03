'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  GripVertical, Plus, Pencil, Trash2, ExternalLink,
  Loader2, Globe, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CustomLink,
  getSuperAdminCustomLinks,
  addCustomLink,
  updateCustomLink,
  deleteCustomLink,
  reorderCustomLinks,
} from '@/lib/api/public-pages'

// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableRow({
  link,
  onEdit,
  onDelete,
  onToggle,
}: {
  link: CustomLink
  onEdit: (l: CustomLink) => void
  onDelete: (l: CustomLink) => void
  onToggle: (l: CustomLink) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon */}
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Title + URL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{link.title}</p>
        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
      </div>

      {/* Active badge */}
      <button
        onClick={() => onToggle(link)}
        className="shrink-0"
        aria-label="Toggle active"
      >
        {link.isActive ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Open link */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* Edit */}
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onEdit(link)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={() => onDelete(link)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Form dialog ───────────────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: CustomLink | null
  onSave: (data: { title: string; url: string; isActive: boolean }) => Promise<void>
  saving: boolean
}

function FormDialog({ open, onOpenChange, initial, onSave, saving }: FormDialogProps) {
  const t = useTranslations('publicPages')
  const [title, setTitle] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [urlError, setUrlError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setUrl(initial?.url ?? '')
      setIsActive(initial?.isActive ?? true)
      setUrlError('')
    }
  }, [open, initial])

  const validateUrl = (val: string) => {
    try {
      const u = new URL(val)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return t('invalidUrl')
      return ''
    } catch {
      return t('invalidUrl')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateUrl(url)
    if (err) { setUrlError(err); return }
    await onSave({ title: title.trim(), url: url.trim(), isActive })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t('editPage') : t('addPage')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>{t('pageTitle')} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('pageTitlePlaceholder')}
              required
              disabled={saving}
            />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label>{t('pageUrl')} *</Label>
            <Input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
              placeholder={t('pageUrlPlaceholder')}
              required
              disabled={saving}
              type="url"
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={saving} id="isActive" />
            <Label htmlFor="isActive">{t('pageActive')}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim() || !url.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {t('addPage')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface PublicPagesManagerProps {
  schoolId: string
}

export function PublicPagesManager({ schoolId }: PublicPagesManagerProps) {
  const t = useTranslations('publicPages')

  const [links, setLinks] = React.useState<CustomLink[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomLink | null>(null)
  const [deleting, setDeleting] = React.useState<CustomLink | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Load
  React.useEffect(() => {
    setLoading(true)
    getSuperAdminCustomLinks(schoolId)
      .then((res) => { if (res.success && res.data) setLinks(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [schoolId])

  // Drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = links.findIndex((l) => l.id === active.id)
    const newIdx = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(links, oldIdx, newIdx)
    setLinks(reordered)
    await reorderCustomLinks(schoolId, reordered.map((l) => l.id)).catch(() => {})
  }

  // Save (add or edit)
  const handleSave = async (data: { title: string; url: string; isActive: boolean }) => {
    setSaving(true)
    try {
      if (editing) {
        const res = await updateCustomLink(schoolId, editing.id, data)
        if (res.success && res.data) {
          setLinks((prev) => prev.map((l) => (l.id === editing.id ? res.data! : l)))
          toast.success(t('savedSuccess'))
        } else {
          toast.error(res.error ?? 'Failed')
        }
      } else {
        const res = await addCustomLink(schoolId, data)
        if (res.success && res.data) {
          setLinks((prev) => [...prev, res.data!])
          toast.success(t('savedSuccess'))
        } else {
          toast.error(res.error ?? 'Failed')
        }
      }
      setFormOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  // Toggle active
  const handleToggle = async (link: CustomLink) => {
    const res = await updateCustomLink(schoolId, link.id, { isActive: !link.isActive })
    if (res.success && res.data) {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? res.data! : l)))
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await deleteCustomLink(schoolId, deleting.id)
      if (res.success) {
        setLinks((prev) => prev.filter((l) => l.id !== deleting.id))
        toast.success(t('deletedSuccess'))
      } else {
        toast.error(res.error ?? 'Failed')
      }
    } finally {
      setSaving(false)
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t('title')}</p>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditing(null); setFormOpen(true) }}
        >
          <Plus className="h-4 w-4 me-1.5" />
          {t('addPage')}
        </Button>
      </div>

      {/* Empty state */}
      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 border rounded-lg border-dashed">
          <Globe className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">{t('emptyTitle')}</p>
          <p className="text-xs text-center max-w-xs">{t('emptyDesc')}</p>
        </div>
      ) : (
        /* Sortable list */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {links.map((link) => (
                <SortableRow
                  key={link.id}
                  link={link}
                  onEdit={(l) => { setEditing(l); setFormOpen(true) }}
                  onDelete={(l) => setDeleting(l)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit form dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null) }}
        initial={editing}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive hover:bg-destructive/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-1.5" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
