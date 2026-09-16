'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
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
import { Lock, Plus, Trash2, Eye, EyeOff, Paperclip, Settings2, Loader2, Search, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { useCampus } from '@/context/CampusContext'
import {
  VAULT_CATEGORIES,
  type VaultCategory,
  type CustomVaultCategory,
  type VaultFieldDefinition,
  type VaultFieldType,
  type VaultRecord,
  listFieldDefinitions,
  createFieldDefinition,
  deleteFieldDefinition,
  listRecords,
  createRecord,
  deleteRecord,
  revealSecret,
  uploadAttachment,
  getAttachmentBlobUrl,
  listCustomCategories,
  createCustomCategory,
  deleteCustomCategory,
  updateCustomCategory,
} from '@/lib/api/vault'

function isExpiringSoon(expiryDate: string | null): 'expired' | 'soon' | null {
  if (!expiryDate) return null
  const days = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'expired'
  if (days <= 30) return 'soon'
  return null
}

// ── Manage Fields dialog ────────────────────────────────────────────────────

function ManageFieldsDialog({
  open,
  onOpenChange,
  category,
  fieldDefs,
  onChanged,
  campusId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: VaultCategory
  fieldDefs: VaultFieldDefinition[]
  onChanged: () => void
  campusId: string | null
}) {
  const t = useTranslations('adminVault')
  const FIELD_TYPES: { value: VaultFieldType; label: string }[] = [
    { value: 'text', label: t('fieldTypeText') },
    { value: 'number', label: t('fieldTypeNumber') },
    { value: 'date', label: t('fieldTypeDate') },
    { value: 'select', label: t('fieldTypeSelectOne') },
    { value: 'multi_select', label: t('fieldTypeSelectMultiple') },
    { value: 'encrypted_text', label: t('fieldTypeEncrypted') },
    { value: 'file', label: t('fieldTypeFile') },
  ]
  const [fieldKey, setFieldKey] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [labelAr, setLabelAr] = useState('')
  const [fieldType, setFieldType] = useState<VaultFieldType>('text')
  const [options, setOptions] = useState('')
  const [isSecret, setIsSecret] = useState(false)
  const [isRequired, setIsRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(fieldDefs.length === 0)

  const filteredFieldDefs = search.trim()
    ? fieldDefs.filter((f) => {
        const q = search.trim().toLowerCase()
        return f.label_en.toLowerCase().includes(q) || f.label_ar.includes(search.trim()) || f.field_key.toLowerCase().includes(q)
      })
    : fieldDefs

  const handleAdd = async () => {
    if (!fieldKey.trim() || !labelEn.trim() || !labelAr.trim()) {
      toast.error(t('fieldKeyAndLabelsRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await createFieldDefinition({
        category,
        field_key: fieldKey.trim(),
        label_en: labelEn.trim(),
        label_ar: labelAr.trim(),
        field_type: fieldType,
        options: options.trim() ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
        is_secret: isSecret,
        is_required: isRequired,
      }, campusId)
      if (res.success) {
        toast.success(t('fieldAdded'))
        setFieldKey(''); setLabelEn(''); setLabelAr(''); setFieldType('text'); setOptions(''); setIsSecret(false); setIsRequired(false)
        onChanged()
      } else {
        toast.error(res.error || t('failedAddField'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await deleteFieldDefinition(id, campusId)
    if (res.success) { toast.success(t('fieldRemoved')); onChanged() }
    else toast.error(res.error || t('failedRemoveField'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> {t('manageFieldsDialogTitle')}</DialogTitle>
          <DialogDescription>{t('manageFieldsDialogDesc')}</DialogDescription>
        </DialogHeader>

        {/* Existing fields: independently bounded/scrolling so a large field
            count never pushes the "Add a field" form out of reach. */}
        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t('fieldCount', { count: fieldDefs.length })}</p>
            {fieldDefs.length > 6 && (
              <div className="relative w-48">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchFieldsPlaceholder')} className="h-7 pl-7 text-xs" />
              </div>
            )}
          </div>

          {fieldDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noCustomFieldsYet')}</p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-1.5">
              {filteredFieldDefs.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t('noFieldsMatch', { search })}</p>}
              {filteredFieldDefs.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border bg-background p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.label_en} <span className="text-xs text-muted-foreground">({f.field_key})</span></p>
                    <p className="text-xs text-muted-foreground">{f.field_type}{f.is_secret ? ' · encrypted' : ''}{f.is_required ? ' · required' : ''}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t pt-3">
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            {t('addAField')}
            {formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {formOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('fieldKey')}</Label>
                  <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder={t('fieldKeyPlaceholder')} disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('type')}</Label>
                  <Select value={fieldType} onValueChange={(v) => setFieldType(v as VaultFieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('labelEnglish')}</Label>
                  <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder={t('labelEnglishPlaceholder')} disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('labelArabic')}</Label>
                  <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" placeholder={t('labelArabicPlaceholder')} disabled={saving} />
                </div>
                {(fieldType === 'select' || fieldType === 'multi_select') && (
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">{t('optionsCommaSeparated')}</Label>
                    <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t('optionsPlaceholder')} disabled={saving} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isSecret} onCheckedChange={setIsSecret} disabled={saving} />
                  <Label className="text-xs">{t('encryptedSecret')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isRequired} onCheckedChange={setIsRequired} disabled={saving} />
                  <Label className="text-xs">{t('required')}</Label>
                </div>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('addField')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Record dialog ───────────────────────────────────────────────────────

function AddRecordDialog({
  open,
  onOpenChange,
  category,
  categories,
  fieldDefs,
  onCreated,
  campusId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: VaultCategory
  categories: { value: VaultCategory; label: string; label_ar: string }[]
  fieldDefs: VaultFieldDefinition[]
  onCreated: () => void
  campusId: string | null
}) {
  const t = useTranslations('adminVault')
  const isAr = useLocale() === 'ar'
  const [title, setTitle] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [attachmentKeys, setAttachmentKeys] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setTitle(''); setSubCategory(''); setExpiryDate(''); setCustomValues({}); setAttachmentKeys([]) }
  }, [open])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAttachment(file, campusId)
      if (res.success && res.data) {
        setAttachmentKeys((prev) => [...prev, res.data!.storageKey])
        toast.success(t('attachmentUploaded'))
      } else {
        toast.error(res.error || t('uploadFailed'))
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !subCategory.trim()) {
      toast.error(t('titleAndSubCategoryRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await createRecord({
        category,
        title: title.trim(),
        sub_category: subCategory.trim(),
        expiry_date: expiryDate || null,
        custom_fields: customValues,
        attachments: attachmentKeys,
      }, campusId)
      if (res.success) {
        toast.success(t('recordCreated'))
        onCreated()
        onOpenChange(false)
      } else {
        toast.error(res.error || t('failedCreateRecord'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('newVaultRecord')}</DialogTitle>
          <DialogDescription>{isAr ? categories.find((c) => c.value === category)?.label_ar : categories.find((c) => c.value === category)?.label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('titleField')}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('subCategory')}</Label>
            <Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder={t('subCategoryPlaceholder')} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('expiryDate')}</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={saving} />
          </div>

          {fieldDefs.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-semibold">{t('customFields')}</p>
              {fieldDefs.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <Label className="text-xs">{f.label_en} {f.is_secret && <Lock className="inline h-3 w-3 ml-1" />}</Label>
                  {f.field_type === 'select' ? (
                    <Select value={customValues[f.field_key] ?? ''} onValueChange={(v) => setCustomValues((p) => ({ ...p, [f.field_key]: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('chooseOption')} /></SelectTrigger>
                      <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : f.is_secret ? 'password' : 'text'}
                      value={customValues[f.field_key] ?? ''}
                      onChange={(e) => setCustomValues((p) => ({ ...p, [f.field_key]: e.target.value }))}
                      disabled={saving}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5 border-t pt-3">
            <Label className="text-xs">{t('attachments')}</Label>
            <input type="file" onChange={handleFile} disabled={uploading || saving} accept="image/jpeg,image/png,image/webp,application/pdf" />
            {attachmentKeys.length > 0 && <p className="text-xs text-muted-foreground">{t('filesAttached', { count: attachmentKeys.length })}</p>}
            {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t('uploading')}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {t('createRecord')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record, fieldDefs, onDeleted, campusId }: { record: VaultRecord; fieldDefs: VaultFieldDefinition[]; onDeleted: () => void; campusId: string | null }) {
  const t = useTranslations('adminVault')
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const expiryState = isExpiringSoon(record.expiry_date)

  const handleReveal = async (fieldKey: string) => {
    setRevealing(fieldKey)
    try {
      const res = await revealSecret(record.id, fieldKey, campusId)
      if (res.success && res.data) setRevealed((p) => ({ ...p, [fieldKey]: res.data!.value }))
      else toast.error(res.error || t('failedRevealSecret'))
    } finally {
      setRevealing(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await deleteRecord(record.id, campusId)
      if (res.success) { toast.success(t('recordDeleted')); onDeleted() }
      else toast.error(res.error || t('failedDeleteRecord'))
    } finally {
      setDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

  const handleViewAttachment = async (index: number) => {
    const res = await getAttachmentBlobUrl(record.id, index, campusId)
    if (res.success && res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error || t('failedLoadAttachment'))
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{record.title}</CardTitle>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px]">{record.sub_category}</Badge>
              {record.expiry_date && (
                <Badge variant={expiryState === 'expired' ? 'destructive' : expiryState === 'soon' ? 'default' : 'outline'} className="text-[10px]">
                  {t('expires', { date: new Date(record.expiry_date).toLocaleDateString() })}
                </Badge>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteRecordTitle', { title: record.title })}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteRecordDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete() }}
            >
              {deleting ? t('deleting') : t('deleteRecordConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CardContent className="space-y-2">
        {fieldDefs.map((f) => {
          const raw = record.custom_fields?.[f.field_key]
          if (raw == null || raw === '') return null
          const isEncrypted = typeof raw === 'string' && raw.startsWith('ENCRYPTED::')
          return (
            <div key={f.field_key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{f.label_en}</span>
              {isEncrypted ? (
                revealed[f.field_key] ? (
                  <span className="font-mono text-xs">{revealed[f.field_key]}</span>
                ) : (
                  <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleReveal(f.field_key)} disabled={revealing === f.field_key}>
                    {revealing === f.field_key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                    {t('reveal')}
                  </Button>
                )
              ) : (
                <span className="font-medium">{String(raw)}</span>
              )}
            </div>
          )
        })}
        {record.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t">
            {record.attachments.map((_, i) => (
              <Button key={i} size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleViewAttachment(i)}>
                <Paperclip className="h-3 w-3" /> {t('attachmentLabel', { index: i + 1 })}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Manage Categories dialog ─────────────────────────────────────────────────

function ManageCategoriesDialog({
  open,
  onOpenChange,
  customCategories,
  onChanged,
  campusId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customCategories: CustomVaultCategory[]
  onChanged: () => void
  campusId: string | null
}) {
  const t = useTranslations('adminVault')
  const isAr = useLocale() === 'ar'
  const [idVal, setIdVal] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [labelAr, setLabelAr] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabelEn, setEditLabelEn] = useState('')
  const [editLabelAr, setEditLabelAr] = useState('')
  const [updating, setUpdating] = useState(false)

  const handleStartEdit = (cat: CustomVaultCategory) => {
    setEditingId(cat.id)
    setEditLabelEn(cat.label_en)
    setEditLabelAr(cat.label_ar)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditLabelEn('')
    setEditLabelAr('')
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    if (!editLabelEn.trim() || !editLabelAr.trim()) {
      toast.error(t('categoryLabelsRequired', { defaultValue: 'English and Arabic labels are required' }))
      return
    }
    setUpdating(true)
    try {
      const res = await updateCustomCategory(editingId, { label_en: editLabelEn.trim(), label_ar: editLabelAr.trim() }, campusId)
      if (res.success) {
        toast.success(t('categoryUpdated', { defaultValue: 'Category updated' }))
        handleCancelEdit()
        onChanged()
      } else {
        toast.error(res.error || t('failedToUpdateCategory', { defaultValue: 'Failed to update category' }))
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleAdd = async () => {
    if (!idVal.trim() || !labelEn.trim() || !labelAr.trim()) {
      toast.error(t('categoryAllFieldsRequired', { defaultValue: 'All fields are required' }))
      return
    }
    setSaving(true)
    try {
      const res = await createCustomCategory({ id: idVal.trim().toLowerCase().replace(/\s+/g, '_'), label_en: labelEn.trim(), label_ar: labelAr.trim() }, campusId)
      if (res.success) {
        toast.success(t('categoryAdded', { defaultValue: 'Category added' }))
        setIdVal(''); setLabelEn(''); setLabelAr('')
        onChanged()
      } else {
        toast.error(res.error || t('failedToAddCategory', { defaultValue: 'Failed to add category' }))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res = await deleteCustomCategory(id, campusId)
      if (res.success) {
        toast.success(t('categoryDeleted', { defaultValue: 'Category deleted' }))
        if (editingId === id) handleCancelEdit()
        onChanged()
      } else {
        toast.error(res.error || t('failedToDeleteCategory', { defaultValue: 'Failed to delete category' }))
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isAr ? 'إدارة تبويبات الخزنة' : 'Manage Vault Categories'}</DialogTitle>
          <DialogDescription>
            {isAr
              ? 'أضف أو عدّل أو احذف أي تبويب، بما في ذلك التبويبات الافتراضية.'
              : 'Add, edit, or remove any category tab — including the default ones.'}
          </DialogDescription>
        </DialogHeader>

        {/* All categories — built-in and custom are equally editable/deletable;
            the backend stores them together (school_settings.vault_custom_categories),
            seeded from DEFAULT_VAULT_CATEGORIES until a school customizes anything. */}
        {customCategories.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'التبويبات' : 'Categories'}</p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {customCategories.map(c => (
                <div key={c.id} className="rounded-lg border px-3 py-2 bg-background">
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">{c.id}</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleSaveEdit}
                            disabled={updating || !editLabelEn.trim() || !editLabelAr.trim()}
                          >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            {isAr ? 'حفظ' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={handleCancelEdit}
                            disabled={updating}
                          >
                            <X className="h-3 w-3" />
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={editLabelEn}
                          onChange={e => setEditLabelEn(e.target.value)}
                          placeholder="English Label"
                          disabled={updating}
                          className="h-8 text-xs"
                        />
                        <Input
                          value={editLabelAr}
                          onChange={e => setEditLabelAr(e.target.value)}
                          dir="rtl"
                          placeholder="الاسم بالعربية"
                          disabled={updating}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {c.label_en} {c.label_ar && <span className="text-muted-foreground font-normal">({c.label_ar})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{c.id}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleStartEdit(c)}
                        >
                          <Pencil className="h-3 w-3" />
                          {isAr ? 'تعديل' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => handleDelete(c.id)}
                          disabled={deleting === c.id}
                        >
                          {deleting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          {isAr ? 'حذف' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new category */}
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isAr ? 'إضافة تبويب جديد' : 'Add New Tab'}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">{isAr ? 'المعرف (بالإنجليزية فقط، أرقام وشرطات سفلية)' : 'ID (English, underscores only)'}</Label>
              <Input
                value={idVal}
                onChange={e => setIdVal(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. safety_records"
                disabled={saving}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isAr ? 'الاسم بالإنجليزية' : 'English Label'}</Label>
              <Input value={labelEn} onChange={e => setLabelEn(e.target.value)} placeholder="Safety Records" disabled={saving} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isAr ? 'الاسم بالعربية' : 'Arabic Label'}</Label>
              <Input value={labelAr} onChange={e => setLabelAr(e.target.value)} dir="rtl" placeholder="سجلات السلامة" disabled={saving} />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !idVal || !labelEn || !labelAr} className="gap-1.5 w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isAr ? 'إضافة التبويب' : 'Add Tab'}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isAr ? 'إغلاق' : 'Close'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminVaultPage() {
  const t = useTranslations('adminVault')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const { isPluginActive, loading: settingsLoading } = useSchoolSettings()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null
  const [category, setCategory] = useState<VaultCategory>('facility_utilities')
  const [records, setRecords] = useState<VaultRecord[]>([])
  const [fieldDefs, setFieldDefs] = useState<VaultFieldDefinition[]>([])
  const [customCategories, setCustomCategories] = useState<CustomVaultCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false)
  const [addRecordOpen, setAddRecordOpen] = useState(false)
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)

  const refreshCategories = useCallback(() => {
    listCustomCategories(campusId).then(res => {
      if (res.success) setCustomCategories(res.data ?? [])
    })
  }, [campusId])

  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([listRecords(category, campusId), listFieldDefinitions(category, campusId)])
      .then(([recordsRes, fieldsRes]) => {
        if (recordsRes.success) setRecords(recordsRes.data ?? [])
        if (fieldsRes.success) setFieldDefs(fieldsRes.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [category, campusId])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { refreshCategories() }, [refreshCategories])

  if (settingsLoading) return null

  if (!isPluginActive('vault')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] text-muted-foreground">
        {t('notEnabled')}
      </div>
    )
  }

  // `customCategories` (from listCustomCategories) is already the complete,
  // authoritative list — the backend returns the 5 built-ins (as-shipped, or
  // edited/renamed) plus any school-added ones, all equally editable. Spreading
  // the static VAULT_CATEGORIES on top used to duplicate every built-in tab
  // the moment a school customized anything; only fall back to the static
  // list before the initial fetch resolves, so tabs aren't empty for a beat.
  const allCategories: { value: VaultCategory; label: string; label_ar: string }[] =
    customCategories.length > 0
      ? customCategories.map(c => ({ value: c.id, label: c.label_en, label_ar: c.label_ar }))
      : VAULT_CATEGORIES

  return (
    <div className="container mx-auto py-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#022172] dark:text-white flex items-center gap-2">
            <Lock className="h-6 w-6" /> {t('pageTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('pageSubtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setManageCategoriesOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
          {isAr ? 'إدارة التبويبات' : 'Manage Tabs'}
        </Button>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as VaultCategory)}>
        <TabsList className="flex-wrap h-auto">
          {allCategories.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{isAr ? c.label_ar : c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{loading ? t('loading') : t('recordsCount', { count: records.length })}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setManageFieldsOpen(true)}>
            <Settings2 className="h-4 w-4" /> {t('manageFields')}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddRecordOpen(true)}>
            <Plus className="h-4 w-4" /> {t('newRecord')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl border bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-white py-16 text-center dark:bg-gray-900">
          <EyeOff className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-muted-foreground">{t('noRecordsYet')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {records.map((r) => <RecordCard key={r.id} record={r} fieldDefs={fieldDefs} onDeleted={refresh} campusId={campusId} />)}
        </div>
      )}

      <ManageFieldsDialog open={manageFieldsOpen} onOpenChange={setManageFieldsOpen} category={category} fieldDefs={fieldDefs} onChanged={refresh} campusId={campusId} />
      <AddRecordDialog open={addRecordOpen} onOpenChange={setAddRecordOpen} category={category} categories={allCategories} fieldDefs={fieldDefs} onCreated={refresh} campusId={campusId} />
      <ManageCategoriesDialog
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
        customCategories={customCategories}
        onChanged={refreshCategories}
        campusId={campusId}
      />
    </div>
  )
}
