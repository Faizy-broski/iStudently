'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  GripVertical, Plus, Pencil, Trash2, ExternalLink,
  Loader2, Globe, Link2, AlignLeft, Image as ImageIcon, Code2,
  Upload, X as XIcon, Shield, Users
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
import { RichTextEditor } from '@/components/ui/rich-text-editor'
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
  type CustomLink,
  type CustomPageType,
  getGlobalCustomLinks,
  addGlobalCustomLink,
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
  reorderGlobalCustomLinks,
} from '@/lib/api/public-pages'

// ── Page type config ──────────────────────────────────────────────────────────

const PAGE_TYPES: { value: CustomPageType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'url',   label: 'External Link', icon: Link2,      desc: 'Opens an external website in a new tab' },
  { value: 'embed', label: 'Embedded Page', icon: Code2,      desc: 'Show a website inside an iframe panel' },
  { value: 'text',  label: 'Text / HTML',   icon: AlignLeft,  desc: 'Display formatted text or HTML content' },
  { value: 'image', label: 'Poster / Image',icon: ImageIcon,  desc: 'Show an image or visual poster' },
]

function typeIcon(type: CustomPageType | undefined) {
  const cfg = PAGE_TYPES.find((t) => t.value === (type ?? 'url'))
  const Icon = cfg?.icon ?? Globe
  return <Icon className="h-4 w-4 text-brand-blue" />
}

function typeLabel(type: CustomPageType | undefined) {
  return PAGE_TYPES.find((t) => t.value === (type ?? 'url'))?.label ?? 'Link'
}

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent']
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
}

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

  const subtitle =
    link.page_type === 'url' || link.page_type === 'embed'
      ? link.url ?? ''
      : link.page_type === 'image'
        ? link.image_url ?? ''
        : link.content
          ? link.content.replace(/<[^>]*>/g, '').slice(0, 60) + (link.content.length > 60 ? '…' : '')
          : ''

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

      {/* Type icon */}
      <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
        {typeIcon(link.page_type)}
      </div>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{link.title}</p>
          <span className="text-[10px] text-muted-foreground border rounded px-1 shrink-0">{typeLabel(link.page_type)}</span>
          {link.visible_to_roles && link.visible_to_roles.length > 0 && (
            <div className="flex gap-1 shrink-0">
              {link.visible_to_roles.map(r => (
                <span key={r} className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-1">{ROLE_LABELS[r]}</span>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>

      {/* Status badge */}
      <Badge
        variant={link.isActive ? 'default' : 'secondary'}
        className={`shrink-0 text-xs cursor-pointer select-none ${link.isActive ? 'bg-green-500 hover:bg-green-600' : ''}`}
        onClick={() => onToggle(link)}
      >
        {link.isActive ? 'Active' : 'Inactive'}
      </Badge>

      {/* Open link — only for url/embed types */}
      {(link.page_type === 'url' || link.page_type === 'embed') && link.url && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-brand-blue transition-colors opacity-0 group-hover:opacity-100"
          title="Open link"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

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
  onSave: (data: Omit<CustomLink, 'id' | 'order'>) => Promise<void>
  saving: boolean
}) {
  const [pageType, setPageType] = React.useState<CustomPageType>('url')
  const [title, setTitle] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [content, setContent] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [isTemplate, setIsTemplate] = React.useState(false)
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [visibleToRoles, setVisibleToRoles] = React.useState<string[]>([])
  const [urlError, setUrlError] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Format date to datetime-local friendly string (YYYY-MM-DDThh:mm)
  const formatForInput = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  React.useEffect(() => {
    if (open) {
      setPageType(initial?.page_type ?? 'url')
      setTitle(initial?.title ?? '')
      setUrl(initial?.url ?? '')
      setContent(initial?.content ?? '')
      setImageUrl(initial?.image_url ?? '')
      setIsActive(initial?.isActive ?? true)
      setIsTemplate(initial?.is_template ?? false)
      setStartDate(formatForInput(initial?.start_date))
      setEndDate(formatForInput(initial?.end_date))
      setVisibleToRoles(initial?.visible_to_roles ?? [])
      setUrlError('')
      setUploadError('')
    }
  }, [open, initial])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { getAuthToken } = await import('@/lib/api/schools')
      const token = await getAuthToken()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/media/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setImageUrl(data.data.url)
        setUrlError('')
      } else {
        setUploadError(data.error ?? 'Upload failed')
      }
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const validateUrl = (val: string) => {
    try { new URL(val); return '' } catch { return 'Please enter a valid URL (e.g. https://example.com)' }
  }

  const isValid = React.useMemo(() => {
    if (!title.trim()) return false
    if (pageType === 'url' || pageType === 'embed') return !!url.trim()
    if (pageType === 'text') return !!content.trim()
    if (pageType === 'image') return !!imageUrl.trim()
    return false
  }, [pageType, title, url, content, imageUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pageType === 'url' || pageType === 'embed') {
      const err = validateUrl(url)
      if (err) { setUrlError(err); return }
    }
    if (pageType === 'image') {
      const err = validateUrl(imageUrl)
      if (err) { setUrlError(err); return }
    }
    await onSave({
      title: title.trim(),
      page_type: pageType,
      url: (pageType === 'url' || pageType === 'embed') ? url.trim() : undefined,
      content: pageType === 'text' ? content : undefined,
      image_url: pageType === 'image' ? imageUrl.trim() : undefined,
      isActive,
      is_template: isTemplate,
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      end_date: endDate ? new Date(endDate).toISOString() : undefined,
      visible_to_roles: visibleToRoles,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${pageType === 'text' ? 'max-w-3xl' : pageType === 'image' ? 'max-w-2xl' : 'max-w-md'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-blue" />
            {initial ? 'Edit Custom Page' : 'Add Custom Page'}
          </DialogTitle>
          <DialogDescription>
            Choose a content type and fill in the details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">

          {/* Page type selector */}
          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TYPES.map((t) => {
                const Icon = t.icon
                const active = pageType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setPageType(t.value); setUrlError('') }}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-start transition-all ${
                      active
                        ? 'border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue'
                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? 'text-brand-blue' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`text-xs font-semibold ${active ? 'text-brand-blue' : ''}`}>{t.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="page-title">Tab Label *</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School Website, Our Story, Upcoming Events…"
              required
              disabled={saving}
            />
          </div>

          {/* URL — for url + embed */}
          {(pageType === 'url' || pageType === 'embed') && (
            <div className="space-y-1.5">
              <Label htmlFor="page-url">
                {pageType === 'embed' ? 'Website URL to Embed *' : 'External URL *'}
              </Label>
              <Input
                id="page-url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
                placeholder="https://example.com"
                required
                disabled={saving}
              />
              {pageType === 'embed' && (
                <p className="text-[11px] text-muted-foreground">
                  The website will be displayed inside an embedded frame. Note: some sites block embedding.
                </p>
              )}
              {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            </div>
          )}

          {/* Content — for text */}
          {pageType === 'text' && (
            <div className="space-y-1.5">
              <Label>Content *</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
              />
            </div>
          )}

          {/* Image URL — for image/poster */}
          {pageType === 'image' && (
            <div className="space-y-3">
              {/* Upload area */}
              <div>
                <Label className="mb-1.5 block">Image / Poster *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={saving || uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || uploading}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-6 hover:border-brand-blue hover:bg-brand-blue/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Uploading…</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload from device</p>
                      <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP, GIF · max 10 MB</p>
                    </>
                  )}
                </button>
                {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground">or paste URL</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* URL input */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <Input
                    id="page-image"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setUrlError('') }}
                    placeholder="https://example.com/poster.jpg"
                    disabled={saving || uploading}
                    className="flex-1"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      title="Clear"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {urlError && <p className="text-xs text-destructive">{urlError}</p>}
              </div>

              {/* Preview */}
              {imageUrl && (
                <div className="rounded-lg border overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full object-contain max-h-52"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3 py-1">
            <Switch
              id="page-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={saving}
            />
            <Label htmlFor="page-active" className="cursor-pointer font-medium">Active (visible on login page)</Label>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <p className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Audience / Portal Visibility</p>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground block mb-2">Select which logged-in users can see this page in their dashboard (if left empty, it will only be a public login page tab):</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map(role => {
                  const checked = visibleToRoles.includes(role)
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setVisibleToRoles(prev => checked ? prev.filter(r => r !== role) : [...prev, role])}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        checked 
                          ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                          : 'bg-transparent border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <p className="text-sm font-semibold">Advanced / Scheduling</p>
            
            <div className="flex items-center gap-3">
              <Switch
                id="page-template"
                checked={isTemplate}
                onCheckedChange={setIsTemplate}
                disabled={saving}
              />
              <Label htmlFor="page-template" className="cursor-pointer">
                Save as Template <span className="text-muted-foreground font-normal">(Hidden from public, keep as draft)</span>
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-xs">Show After (Optional)</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={saving || isTemplate}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date" className="text-xs">Hide After (Optional)</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={saving || isTemplate}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              If dates are set, the page will only be visible on the login screen during this schedule. 
              Leave empty to show indefinitely. Templates are never shown.
            </p>
          </div>

          <DialogFooter className="pt-2 border-t">
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
              disabled={saving || uploading || !isValid}
              className="gradient-blue text-white border-0"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {initial ? 'Save Changes' : 'Add Page'}
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

  React.useEffect(() => {
    setLoading(true)
    getGlobalCustomLinks()
      .then((res) => { if (res.success && res.data) setLinks(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = links.findIndex((l) => l.id === active.id)
    const newIdx = links.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(links, oldIdx, newIdx)
    setLinks(reordered)
    await reorderGlobalCustomLinks(reordered.map((l) => l.id)).catch(() => {})
  }

  const handleSave = async (data: Omit<CustomLink, 'id' | 'order'>) => {
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

  const handleToggle = async (link: CustomLink) => {
    const res = await updateGlobalCustomLink(link.id, { isActive: !link.isActive })
    if (res.success && res.data) {
      setLinks((prev) => prev.map((l) => (l.id === link.id ? res.data! : l)))
    }
  }

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
          These tabs appear on the school login page. Each page can be an <strong>external link</strong>, an <strong>embedded website</strong>,
          a <strong>text/HTML block</strong>, or an <strong>image poster</strong>.
          Only <strong>Active</strong> pages are visible. Drag rows to reorder.
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
