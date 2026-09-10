'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import { Lock, Plus, Trash2, Eye, EyeOff, Paperclip, Settings2, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { useCampus } from '@/context/CampusContext'
import {
  VAULT_CATEGORIES,
  type VaultCategory,
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
} from '@/lib/api/vault'

const FIELD_TYPES: { value: VaultFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (one)' },
  { value: 'multi_select', label: 'Select (multiple)' },
  { value: 'encrypted_text', label: 'Encrypted Text' },
  { value: 'file', label: 'File' },
]

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
      toast.error('Field key and both labels are required')
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
        toast.success('Field added')
        setFieldKey(''); setLabelEn(''); setLabelAr(''); setFieldType('text'); setOptions(''); setIsSecret(false); setIsRequired(false)
        onChanged()
      } else {
        toast.error(res.error || 'Failed to add field')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await deleteFieldDefinition(id, campusId)
    if (res.success) { toast.success('Field removed'); onChanged() }
    else toast.error(res.error || 'Failed to remove field')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Manage Fields</DialogTitle>
          <DialogDescription>Custom fields shown on every record in this category.</DialogDescription>
        </DialogHeader>

        {/* Existing fields: independently bounded/scrolling so a large field
            count never pushes the "Add a field" form out of reach. */}
        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{fieldDefs.length} field{fieldDefs.length === 1 ? '' : 's'}</p>
            {fieldDefs.length > 6 && (
              <div className="relative w-48">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fields..." className="h-7 pl-7 text-xs" />
              </div>
            )}
          </div>

          {fieldDefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom fields yet for this category.</p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-1.5">
              {filteredFieldDefs.length === 0 && <p className="p-2 text-sm text-muted-foreground">No fields match &quot;{search}&quot;.</p>}
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
            Add a field
            {formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {formOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Field Key</Label>
                  <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="meter_serial_number" disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={fieldType} onValueChange={(v) => setFieldType(v as VaultFieldType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label (English)</Label>
                  <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} placeholder="Meter Serial Number" disabled={saving} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label (Arabic)</Label>
                  <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" placeholder="رقم العداد التسلسلي" disabled={saving} />
                </div>
                {(fieldType === 'select' || fieldType === 'multi_select') && (
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="MONTHLY, QUARTERLY, ANNUALLY" disabled={saving} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isSecret} onCheckedChange={setIsSecret} disabled={saving} />
                  <Label className="text-xs">Encrypted secret</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isRequired} onCheckedChange={setIsRequired} disabled={saving} />
                  <Label className="text-xs">Required</Label>
                </div>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Field
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
  fieldDefs,
  onCreated,
  campusId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: VaultCategory
  fieldDefs: VaultFieldDefinition[]
  onCreated: () => void
  campusId: string | null
}) {
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
        toast.success('Attachment uploaded')
      } else {
        toast.error(res.error || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !subCategory.trim()) {
      toast.error('Title and sub-category are required')
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
        toast.success('Record created')
        onCreated()
        onOpenChange(false)
      } else {
        toast.error(res.error || 'Failed to create record')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Vault Record</DialogTitle>
          <DialogDescription>{VAULT_CATEGORIES.find((c) => c.value === category)?.label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Main Campus - Building A Transformer" disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sub-category *</Label>
            <Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder="ELECTRICITY_METER" disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Expiry Date</Label>
            <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={saving} />
          </div>

          {fieldDefs.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-semibold">Custom fields</p>
              {fieldDefs.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <Label className="text-xs">{f.label_en} {f.is_secret && <Lock className="inline h-3 w-3 ml-1" />}</Label>
                  {f.field_type === 'select' ? (
                    <Select value={customValues[f.field_key] ?? ''} onValueChange={(v) => setCustomValues((p) => ({ ...p, [f.field_key]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
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
            <Label className="text-xs">Attachments</Label>
            <input type="file" onChange={handleFile} disabled={uploading || saving} accept="image/jpeg,image/png,image/webp,application/pdf" />
            {attachmentKeys.length > 0 && <p className="text-xs text-muted-foreground">{attachmentKeys.length} file(s) attached</p>}
            {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ record, fieldDefs, onDeleted, campusId }: { record: VaultRecord; fieldDefs: VaultFieldDefinition[]; onDeleted: () => void; campusId: string | null }) {
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<string | null>(null)
  const expiryState = isExpiringSoon(record.expiry_date)

  const handleReveal = async (fieldKey: string) => {
    setRevealing(fieldKey)
    try {
      const res = await revealSecret(record.id, fieldKey, campusId)
      if (res.success && res.data) setRevealed((p) => ({ ...p, [fieldKey]: res.data!.value }))
      else toast.error(res.error || 'Failed to reveal secret')
    } finally {
      setRevealing(null)
    }
  }

  const handleDelete = async () => {
    const res = await deleteRecord(record.id, campusId)
    if (res.success) { toast.success('Record deleted'); onDeleted() }
    else toast.error(res.error || 'Failed to delete record')
  }

  const handleViewAttachment = async (index: number) => {
    const res = await getAttachmentBlobUrl(record.id, index, campusId)
    if (res.success && res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
    else toast.error(res.error || 'Failed to load attachment')
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
                  Expires {new Date(record.expiry_date).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
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
                    Reveal
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
                <Paperclip className="h-3 w-3" /> Attachment {i + 1}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminVaultPage() {
  const { isPluginActive, loading: settingsLoading } = useSchoolSettings()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null
  const [category, setCategory] = useState<VaultCategory>('facility_utilities')
  const [records, setRecords] = useState<VaultRecord[]>([])
  const [fieldDefs, setFieldDefs] = useState<VaultFieldDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false)
  const [addRecordOpen, setAddRecordOpen] = useState(false)

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

  if (settingsLoading) return null

  if (!isPluginActive('vault')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] text-muted-foreground">
        AdminVault isn&apos;t enabled for your school.
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#022172] dark:text-white flex items-center gap-2">
            <Lock className="h-6 w-6" /> AdminVault
          </h1>
          <p className="text-muted-foreground text-sm">Facility, legal, financial, IT, and HR records — encrypted, audited, access-controlled.</p>
        </div>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as VaultCategory)}>
        <TabsList className="flex-wrap h-auto">
          {VAULT_CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{loading ? 'Loading…' : `${records.length} record(s)`}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setManageFieldsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Manage Fields
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddRecordOpen(true)}>
            <Plus className="h-4 w-4" /> New Record
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
          <p className="text-sm font-medium text-muted-foreground">No records in this category yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {records.map((r) => <RecordCard key={r.id} record={r} fieldDefs={fieldDefs} onDeleted={refresh} campusId={campusId} />)}
        </div>
      )}

      <ManageFieldsDialog open={manageFieldsOpen} onOpenChange={setManageFieldsOpen} category={category} fieldDefs={fieldDefs} onChanged={refresh} campusId={campusId} />
      <AddRecordDialog open={addRecordOpen} onOpenChange={setAddRecordOpen} category={category} fieldDefs={fieldDefs} onCreated={refresh} campusId={campusId} />
    </div>
  )
}
