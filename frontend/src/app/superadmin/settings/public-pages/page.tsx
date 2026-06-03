'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  GripVertical, Plus, Pencil, Trash2, ExternalLink,
  Loader2, Globe, CheckCircle2, XCircle, TrendingDown,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  getGlobalCustomLinks,
  addGlobalCustomLink,
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
  reorderGlobalCustomLinks,
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
      className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors group"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Globe icon */}
      <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
        <Globe className="h-4 w-4 text-brand-blue" />
      </div>

      {/* Title + URL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{link.title}</p>
        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
      </div>

      {/* Status badge */}
      <Badge
        variant={link.isActive ? 'default' : 'secondary'}
        className={`shrink-0 text-xs cursor-pointer select-none ${link.isActive ? 'bg-green-500 hover:bg-green-600' : ''}`}
        onClick={() => onToggle(link)}
      >
        {link.isActive ? 'Active' : 'Inactive'}
      </Badge>

      {/* Open link */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground hover:text-brand-blue transition-colors opacity-0 group-hover:opacity-100"
        title="Open link"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={() => onEdit(link)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
        onClick={() => onDelete(link)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Form dialog ───────────────────────────────────────────────────────────────

function FormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: CustomLink | null
  onSave: (data: { title: string; url: string; isActive: boolean }) => Promise<void>
  saving: boolean
}) {
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
      new URL(val)
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
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-blue" />
            {initial ? t('editPage') : t('addPage')}
          </DialogTitle>
          <DialogDescription>
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="page-title">{t('pageTitle')} *</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('pageTitlePlaceholder')}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="page-url">{t('pageUrl')} *</Label>
            <Input
              id="page-url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
              placeholder={t('pageUrlPlaceholder')}
              required
              disabled={saving}
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>

          <div className="flex items-center gap-3 py-1">
            <Switch
              id="page-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={saving}
            />
            <Label htmlFor="page-active" className="cursor-pointer">{t('pageActive')}</Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim() || !url.trim()}
              className="gradient-blue text-white border-0"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {initial ? t('editPage') : t('addPage')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicPagesSettingsPage() {
  const t = useTranslations('publicPages')

  const [links, setLinks] = React.useState<CustomLink[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomLink | null>(null)
  const [deleting, setDeleting] = React.useState<CustomLink | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Load
  React.useEffect(() => {
    setLoading(true)
    getGlobalCustomLinks()
      .then((res) => { if (res.success && res.data) setLinks(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Drag end — reorder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = links.findIndex((l) => l.id === active.id)
    const newIdx = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(links, oldIdx, newIdx)
    setLinks(reordered)
    await reorderGlobalCustomLinks(reordered.map((l) => l.id)).catch(() => {})
  }

  // Save (add or edit)
  const handleSave = async (data: { title: string; url: string; isActive: boolean }) => {
    setSaving(true)
    try {
      if (editing) {
        const res = await updateGlobalCustomLink(editing.id, data)
        if (res.success && res.data) {
          setLinks((prev) => prev.map((l) => (l.id === editing.id ? res.data! : l)))
          toast.success(t('savedSuccess'))
          setFormOpen(false)
          setEditing(null)
        } else toast.error(res.error ?? 'Failed')
      } else {
        const res = await addGlobalCustomLink(data)
        if (res.success && res.data) {
          setLinks((prev) => [...prev, res.data!])
          toast.success(t('savedSuccess'))
          setFormOpen(false)
        } else toast.error(res.error ?? 'Failed')
      }
    } finally {
      setSaving(false)
    }
  }

  // Toggle active inline
  const handleToggle = async (link: CustomLink) => {
    const res = await updateGlobalCustomLink(link.id, { isActive: !link.isActive })
    if (res.success && res.data) {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? res.data! : l)))
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await deleteGlobalCustomLink(deleting.id)
      if (res.success) {
        setLinks((prev) => prev.filter((l) => l.id !== deleting.id))
        toast.success(t('deletedSuccess'))
      } else toast.error(res.error ?? 'Failed')
    } finally {
      setSaving(false)
      setDeleting(null)
    }
  }

  const activeCount = links.filter((l) => l.isActive).length

  return (
    <div className="container mx-auto py-6 max-w-3xl space-y-6">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3">
        <Globe className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          These links appear as clickable tabs on the school login page. Only <strong>Active</strong> pages are visible to users.
          Drag rows to change the display order.
        </p>
      </div>

      {/* Main card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Login Page Tabs</CardTitle>
              <CardDescription className="mt-0.5">
                {links.length === 0
                  ? 'No custom pages yet'
                  : `${links.length} page${links.length !== 1 ? 's' : ''} · ${activeCount} active`}
              </CardDescription>
            </div>
            <Button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="gradient-blue text-white border-0 gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('addPage')}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Globe className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-medium">{t('emptyTitle')}</p>
              <p className="text-sm text-center max-w-xs">{t('emptyDesc')}</p>
              <Button
                variant="outline"
                className="mt-2 gap-2"
                onClick={() => { setEditing(null); setFormOpen(true) }}
              >
                <Plus className="h-4 w-4" />
                {t('addPage')}
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={links.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
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
        </CardContent>
      </Card>

      {/* Preview note */}
      {links.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          These tabs will appear on the login page for all users automatically.
        </p>
      )}

      {/* Add / Edit dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null) }}
        initial={editing}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin me-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
