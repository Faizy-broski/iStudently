import type { VaultCustomCategory, VaultFieldDefinition, VaultFieldType, VaultRecord } from '@studently/api-client';
import { VAULT_CATEGORIES } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Paperclip, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField, formatYmd, parseYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminVault } from '@/lib/api';
import { confirmIdentity } from '@/lib/biometric';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { pickDocuments } from '@/lib/upload';

type Cat = { value: string; label: string; label_ar: string };

const ATTACHMENT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

function expiryState(date: string | null): 'expired' | 'soon' | null {
  const d = parseYmd(date?.slice(0, 10));
  if (!d) return null;
  const days = (d.getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  return null;
}

function useVt() {
  const { t, i18n } = useTranslation();
  return { v: (k: string, o?: Record<string, unknown>) => t(`adminVault.${k}`, o), a: (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o), isAr: i18n.language === 'ar', lang: i18n.language };
}

function Sheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90%] w-[94vw] max-w-md">
        <KeyboardAvoidingView>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

// ── Manage fields ───────────────────────────────────────────────────────────
function ManageFields({ open, onClose, category, fieldDefs, onChanged }: { open: boolean; onClose: () => void; category: string; fieldDefs: VaultFieldDefinition[]; onChanged: () => void }) {
  const { v } = useVt();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const FIELD_TYPES: { value: VaultFieldType; label: string }[] = [
    { value: 'text', label: v('fieldTypeText') },
    { value: 'number', label: v('fieldTypeNumber') },
    { value: 'date', label: v('fieldTypeDate') },
    { value: 'select', label: v('fieldTypeSelectOne') },
    { value: 'multi_select', label: v('fieldTypeSelectMultiple') },
    { value: 'encrypted_text', label: v('fieldTypeEncrypted') },
    { value: 'file', label: v('fieldTypeFile') },
  ];
  const [fieldKey, setFieldKey] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [fieldType, setFieldType] = useState<VaultFieldType>('text');
  const [options, setOptions] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // Mounted only while open, so the initial state is the per-open reset.
  const noFields = fieldDefs.length === 0;
  const [formOpen, setFormOpen] = useState(noFields);

  const q = search.trim().toLowerCase();
  const shown = q ? fieldDefs.filter((f) => f.label_en.toLowerCase().includes(q) || f.label_ar.includes(search.trim()) || f.field_key.toLowerCase().includes(q)) : fieldDefs;

  async function add() {
    if (!fieldKey.trim() || !labelEn.trim() || !labelAr.trim()) return toast.error(v('fieldKeyAndLabelsRequired'));
    setSaving(true);
    try {
      const res = await adminVault.createFieldDefinition(
        {
          category,
          field_key: fieldKey.trim(),
          label_en: labelEn.trim(),
          label_ar: labelAr.trim(),
          field_type: fieldType,
          options: options.trim() ? options.split(',').map((o) => o.trim()).filter(Boolean) : [],
          is_secret: isSecret,
          is_required: isRequired,
        },
        campusId,
      );
      if (!res.success) return toast.error(res.error || v('failedAddField'));
      toast.success(v('fieldAdded'));
      setFieldKey('');
      setLabelEn('');
      setLabelAr('');
      setFieldType('text');
      setOptions('');
      setIsSecret(false);
      setIsRequired(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: VaultFieldDefinition) {
    if (!(await confirm({ title: `${f.label_en} (${f.field_key})`, destructive: true, confirmLabel: v('deleteRecordConfirm') }))) return;
    const res = await adminVault.deleteFieldDefinition(f.id, campusId);
    if (!res.success) return toast.error(res.error || v('failedRemoveField'));
    toast.success(v('fieldRemoved'));
    onChanged();
  }

  return (
    <Sheet open={open} onClose={onClose} title={v('manageFieldsDialogTitle')} description={v('manageFieldsDialogDesc')}>
      <Text className="text-muted-foreground text-xs font-medium">{v('fieldCount', { count: fieldDefs.length })}</Text>
      {fieldDefs.length > 6 ? <Input value={search} onChangeText={setSearch} placeholder={v('searchFieldsPlaceholder')} /> : null}
      {noFields ? (
        <Text className="text-muted-foreground text-sm">{v('noCustomFieldsYet')}</Text>
      ) : (
        <View className="gap-1.5">
          {!shown.length ? <Text className="text-muted-foreground text-sm">{v('noFieldsMatch', { search })}</Text> : null}
          {shown.map((f) => (
            <View key={f.id} className="border-border flex-row items-center gap-2 rounded-md border p-2">
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {f.label_en} <Text className="text-muted-foreground text-xs">({f.field_key})</Text>
                </Text>
                <Text className="text-muted-foreground text-xs">
                  {f.field_type}
                  {f.is_secret ? ' · encrypted' : ''}
                  {f.is_required ? ' · required' : ''}
                </Text>
              </View>
              <Pressable onPress={() => remove(f)} hitSlop={6} className="p-1" accessibilityLabel={v('deleteRecordConfirm')}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Pressable onPress={() => setFormOpen((x) => !x)} className="border-border flex-row items-center justify-between border-t pt-3">
        <Text className="text-sm font-semibold">{v('addAField')}</Text>
        <Icon as={formOpen ? ChevronUp : ChevronDown} className="text-foreground size-4" />
      </Pressable>
      {formOpen ? (
        <View className="gap-3">
          <View className="gap-1.5">
            <Label>{v('fieldKey')}</Label>
            <Input value={fieldKey} onChangeText={setFieldKey} placeholder={v('fieldKeyPlaceholder')} autoCapitalize="none" editable={!saving} />
          </View>
          <View className="gap-1.5">
            <Label>{v('type')}</Label>
            <Picker value={fieldType} onChange={(x) => setFieldType(x as VaultFieldType)} options={FIELD_TYPES} />
          </View>
          <View className="gap-1.5">
            <Label>{v('labelEnglish')}</Label>
            <Input value={labelEn} onChangeText={setLabelEn} placeholder={v('labelEnglishPlaceholder')} editable={!saving} />
          </View>
          <View className="gap-1.5">
            <Label>{v('labelArabic')}</Label>
            <Input value={labelAr} onChangeText={setLabelAr} placeholder={v('labelArabicPlaceholder')} style={{ writingDirection: 'rtl', textAlign: 'right' }} editable={!saving} />
          </View>
          {fieldType === 'select' || fieldType === 'multi_select' ? (
            <View className="gap-1.5">
              <Label>{v('optionsCommaSeparated')}</Label>
              <Input value={options} onChangeText={setOptions} placeholder={v('optionsPlaceholder')} editable={!saving} />
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-6">
            <View className="flex-row items-center gap-2">
              <Switch checked={isSecret} onCheckedChange={setIsSecret} disabled={saving} />
              <Label>{v('encryptedSecret')}</Label>
            </View>
            <View className="flex-row items-center gap-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} disabled={saving} />
              <Label>{v('required')}</Label>
            </View>
          </View>
          <Button size="sm" onPress={add} disabled={saving}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{v('addField')}</Text>
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}

// ── Add record ──────────────────────────────────────────────────────────────
function AddRecord({ open, onClose, category, categories, fieldDefs, onCreated }: { open: boolean; onClose: () => void; category: string; categories: Cat[]; fieldDefs: VaultFieldDefinition[]; onCreated: () => void }) {
  const { v, a, isAr } = useVt();
  const toast = useToast();
  const { campusId } = useCampus();
  const [title, setTitle] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function attach() {
    const [f] = await pickDocuments({ multiple: false });
    if (!f) return;
    if (!ATTACHMENT_TYPES[f.type]) return toast.error(a('vt_file_type'));
    setUploading(true);
    try {
      const res = await adminVault.uploadAttachment({ uri: f.uri, name: f.name, type: f.type }, campusId);
      if (!res.success || !res.data) return toast.error(res.error || v('uploadFailed'));
      const key = res.data.storageKey;
      setKeys((p) => [...p, key]);
      toast.success(v('attachmentUploaded'));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim() || !subCategory.trim()) return toast.error(v('titleAndSubCategoryRequired'));
    setSaving(true);
    try {
      const res = await adminVault.createRecord({ category, title: title.trim(), sub_category: subCategory.trim(), expiry_date: expiryDate || null, custom_fields: values, attachments: keys }, campusId);
      if (!res.success) return toast.error(res.error || v('failedCreateRecord'));
      toast.success(v('recordCreated'));
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const cat = categories.find((c) => c.value === category);
  const set = (k: string, val: string) => setValues((p) => ({ ...p, [k]: val }));
  return (
    <Sheet open={open} onClose={onClose} title={v('newVaultRecord')} description={cat ? (isAr ? cat.label_ar : cat.label) : undefined}>
      <View className="gap-1.5">
        <Label>{v('titleField')}</Label>
        <Input value={title} onChangeText={setTitle} placeholder={v('titlePlaceholder')} editable={!saving} />
      </View>
      <View className="gap-1.5">
        <Label>{v('subCategory')}</Label>
        <Input value={subCategory} onChangeText={setSubCategory} placeholder={v('subCategoryPlaceholder')} editable={!saving} />
      </View>
      <DateField label={v('expiryDate')} value={expiryDate} onChange={setExpiryDate} clearable />
      {fieldDefs.length ? (
        <View className="border-border gap-3 border-t pt-3">
          <Text className="text-sm font-semibold">{v('customFields')}</Text>
          {fieldDefs.map((f) => (
            <View key={f.id} className="gap-1.5">
              <View className="flex-row items-center gap-1">
                <Label>{f.label_en}</Label>
                {f.is_secret ? <Icon as={Lock} className="text-muted-foreground size-3" /> : null}
              </View>
              {f.field_type === 'select' ? (
                <Picker value={values[f.field_key] ?? ''} onChange={(x) => set(f.field_key, x)} placeholder={v('chooseOption')} options={f.options.map((o) => ({ value: o, label: o }))} />
              ) : f.field_type === 'date' ? (
                <DateField value={values[f.field_key] ?? ''} onChange={(x) => set(f.field_key, x)} clearable />
              ) : (
                <Input
                  value={values[f.field_key] ?? ''}
                  onChangeText={(x) => set(f.field_key, x)}
                  keyboardType={f.field_type === 'number' ? 'decimal-pad' : 'default'}
                  secureTextEntry={f.is_secret}
                  autoCapitalize={f.is_secret ? 'none' : 'sentences'}
                  editable={!saving}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View className="border-border gap-1.5 border-t pt-3">
        <Label>{v('attachments')}</Label>
        <Button size="sm" variant="outline" onPress={attach} disabled={uploading || saving}>
          <Icon as={Paperclip} className="text-foreground size-4" />
          <Text>{uploading ? v('uploading') : a('vt_choose_file')}</Text>
        </Button>
        {keys.length ? <Text className="text-muted-foreground text-xs">{v('filesAttached', { count: keys.length })}</Text> : null}
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
          <Text>{v('cancel')}</Text>
        </Button>
        <Button className="flex-1" onPress={save} disabled={saving || uploading}>
          <Text>{v('createRecord')}</Text>
        </Button>
      </View>
    </Sheet>
  );
}

// ── Record card ─────────────────────────────────────────────────────────────
function RecordCard({ record, fieldDefs, onDeleted }: { record: VaultRecord; fieldDefs: VaultFieldDefinition[]; onDeleted: () => void }) {
  const { v, a, lang } = useVt();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const exp = expiryState(record.expiry_date);
  const recordId = record.id;

  async function reveal(fieldKey: string) {
    // Secrets need the device owner again (Face ID / fingerprint / passcode), not just an open app.
    if (!(await confirmIdentity(a('vt_reveal_reason')))) return;
    setRevealing(fieldKey);
    try {
      const res = await adminVault.revealSecret(recordId, fieldKey, campusId);
      if (!res.success || !res.data) return toast.error(res.error || v('failedRevealSecret'));
      const value = res.data.value;
      setRevealed((p) => ({ ...p, [fieldKey]: value }));
    } finally {
      setRevealing(null);
    }
  }

  async function remove() {
    if (!(await confirm({ title: v('deleteRecordTitle', { title: record.title }), body: v('deleteRecordDesc'), destructive: true, confirmLabel: v('deleteRecordConfirm') }))) return;
    const res = await adminVault.deleteRecord(recordId, campusId);
    if (!res.success) return toast.error(res.error || v('failedDeleteRecord'));
    toast.success(v('recordDeleted'));
    onDeleted();
  }

  async function view(index: number, key: string) {
    const ext = (key.split('.').pop() ?? '').toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
    try {
      await shareApiFile(adminVault.attachmentPath(recordId, index, campusId), `attachment-${index + 1}${MIME_BY_EXT[ext] ? `.${ext}` : ''}`, mime);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : v('failedLoadAttachment'));
    }
  }

  return (
    <Card>
      <CardContent className="gap-2 pt-4">
        <View className="flex-row items-start gap-2">
          <View className="flex-1 gap-1.5">
            <Text className="font-semibold">{record.title}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              <Badge variant="outline">
                <Text className="text-[10px]">{record.sub_category}</Text>
              </Badge>
              {record.expiry_date ? (
                <Badge variant={exp === 'expired' ? 'destructive' : exp === 'soon' ? 'default' : 'outline'}>
                  <Text className="text-[10px]">{v('expires', { date: formatYmd(record.expiry_date.slice(0, 10), lang) })}</Text>
                </Badge>
              ) : null}
            </View>
          </View>
          <Pressable onPress={remove} hitSlop={6} className="p-1" accessibilityLabel={v('deleteRecordConfirm')}>
            <Icon as={Trash2} className="text-destructive size-4" />
          </Pressable>
        </View>
        {fieldDefs.map((f) => {
          const raw = record.custom_fields?.[f.field_key];
          if (raw == null || raw === '') return null;
          const encrypted = typeof raw === 'string' && raw.startsWith('ENCRYPTED::');
          return (
            <View key={f.field_key} className="flex-row items-center justify-between gap-2">
              <Text className="text-muted-foreground text-sm">{f.label_en}</Text>
              {encrypted ? (
                revealed[f.field_key] ? (
                  <Text className="font-mono text-sm" selectable>
                    {revealed[f.field_key]}
                  </Text>
                ) : (
                  <Button size="sm" variant="outline" onPress={() => reveal(f.field_key)} disabled={revealing === f.field_key}>
                    <Icon as={Eye} className="text-foreground size-3.5" />
                    <Text>{v('reveal')}</Text>
                  </Button>
                )
              ) : (
                <Text className="shrink text-end text-sm" selectable>
                  {String(raw)}
                </Text>
              )}
            </View>
          );
        })}
        {record.attachments.length ? (
          <View className="flex-row flex-wrap gap-2 pt-1">
            {record.attachments.map((key, i) => (
              <Button key={i} size="sm" variant="outline" onPress={() => view(i, key)}>
                <Icon as={Paperclip} className="text-foreground size-3.5" />
                <Text>{v('attachmentLabel', { index: i + 1 })}</Text>
              </Button>
            ))}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Manage categories (tabs) ────────────────────────────────────────────────
function ManageCategories({ open, onClose, categories, onChanged }: { open: boolean; onClose: () => void; categories: VaultCustomCategory[]; onChanged: () => void }) {
  const { v, a } = useVt();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const [idVal, setIdVal] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editAr, setEditAr] = useState('');
  const [busy, setBusy] = useState(false);

  const cancelEdit = () => {
    setEditingId(null);
    setEditEn('');
    setEditAr('');
  };

  async function saveEdit() {
    if (!editingId) return;
    if (!editEn.trim() || !editAr.trim()) return toast.error(v('categoryLabelsRequired'));
    setBusy(true);
    try {
      const res = await adminVault.updateCustomCategory(editingId, { label_en: editEn.trim(), label_ar: editAr.trim() }, campusId);
      if (!res.success) return toast.error(res.error || v('failedToUpdateCategory'));
      toast.success(v('categoryUpdated'));
      cancelEdit();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!idVal.trim() || !labelEn.trim() || !labelAr.trim()) return toast.error(v('categoryAllFieldsRequired'));
    setSaving(true);
    try {
      const res = await adminVault.createCustomCategory({ id: idVal.trim().toLowerCase().replace(/\s+/g, '_'), label_en: labelEn.trim(), label_ar: labelAr.trim() }, campusId);
      if (!res.success) return toast.error(res.error || v('failedToAddCategory'));
      toast.success(v('categoryAdded'));
      setIdVal('');
      setLabelEn('');
      setLabelAr('');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: VaultCustomCategory) {
    if (!(await confirm({ title: a('vt_delete_tab', { name: c.label_en }), destructive: true, confirmLabel: a('vt_delete') }))) return;
    setBusy(true);
    try {
      const res = await adminVault.deleteCustomCategory(c.id, campusId);
      if (!res.success) return toast.error(res.error || v('failedToDeleteCategory'));
      toast.success(v('categoryDeleted'));
      if (editingId === c.id) cancelEdit();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={a('vt_manage_tabs_title')} description={a('vt_manage_tabs_desc')}>
      {categories.length ? (
        <View className="gap-1.5">
          <Text className="text-muted-foreground text-xs font-medium">{a('vt_categories')}</Text>
          {categories.map((c) => (
            <View key={c.id} className="border-border gap-2 rounded-md border p-2">
              {editingId === c.id ? (
                <>
                  <Text className="text-muted-foreground font-mono text-xs">{c.id}</Text>
                  <Input value={editEn} onChangeText={setEditEn} placeholder="English Label" editable={!busy} />
                  <Input value={editAr} onChangeText={setEditAr} placeholder="الاسم بالعربية" style={{ writingDirection: 'rtl', textAlign: 'right' }} editable={!busy} />
                  <View className="flex-row gap-2">
                    <Button size="sm" className="flex-1" onPress={saveEdit} disabled={busy || !editEn.trim() || !editAr.trim()}>
                      <Icon as={Check} className="text-primary-foreground size-3.5" />
                      <Text>{a('vt_save')}</Text>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onPress={cancelEdit} disabled={busy}>
                      <Icon as={X} className="text-foreground size-3.5" />
                      <Text>{v('cancel')}</Text>
                    </Button>
                  </View>
                </>
              ) : (
                <View className="flex-row items-center gap-2">
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-medium">
                      {c.label_en} {c.label_ar ? <Text className="text-muted-foreground text-sm">({c.label_ar})</Text> : null}
                    </Text>
                    <Text className="text-muted-foreground font-mono text-xs">{c.id}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingId(c.id);
                      setEditEn(c.label_en);
                      setEditAr(c.label_ar);
                    }}
                    hitSlop={6}
                    className="p-1"
                    accessibilityLabel={a('vt_edit')}>
                    <Icon as={Pencil} className="text-muted-foreground size-4" />
                  </Pressable>
                  <Pressable onPress={() => remove(c)} disabled={busy} hitSlop={6} className="p-1" accessibilityLabel={a('vt_delete')}>
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View className="border-border gap-3 border-t pt-3">
        <Text className="text-sm font-semibold">{a('vt_add_tab_title')}</Text>
        <View className="gap-1.5">
          <Label>{a('vt_tab_id')}</Label>
          <Input value={idVal} onChangeText={(x) => setIdVal(x.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="e.g. safety_records" autoCapitalize="none" autoCorrect={false} editable={!saving} />
        </View>
        <View className="gap-1.5">
          <Label>{v('labelEnglish')}</Label>
          <Input value={labelEn} onChangeText={setLabelEn} placeholder="Safety Records" editable={!saving} />
        </View>
        <View className="gap-1.5">
          <Label>{v('labelArabic')}</Label>
          <Input value={labelAr} onChangeText={setLabelAr} placeholder="سجلات السلامة" style={{ writingDirection: 'rtl', textAlign: 'right' }} editable={!saving} />
        </View>
        <Button size="sm" onPress={add} disabled={saving || !idVal || !labelEn || !labelAr}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{a('vt_add_tab')}</Text>
        </Button>
      </View>
      <Button variant="outline" onPress={onClose}>
        <Text>{a('vt_close')}</Text>
      </Button>
    </Sheet>
  );
}

/** Confidential school records by category (web: /admin/vault). Secrets are revealed one at a time after device re-auth. */
export default function VaultScreen() {
  const { v, a, isAr } = useVt();
  const { campusId } = useCampus();
  const [category, setCategory] = useState('facility_utilities');
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  const cats = useApi(['admin', 'vault-categories', campusId ?? 'school'], () => adminVault.customCategories(campusId));

  // The categories endpoint returns the complete list (built-ins as edited plus school-added ones);
  // the static list only fills the gap before it loads.
  const custom = cats.data ?? [];
  const all: Cat[] = custom.length ? custom.map((c) => ({ value: c.id, label: c.label_en, label_ar: c.label_ar })) : VAULT_CATEGORIES;
  const current = all.some((c) => c.value === category) ? category : (all[0]?.value ?? category);
  const records = useApi(['admin', 'vault-records', current, campusId ?? 'school'], ([, , c]) => adminVault.records(campusId, c as string));
  const fields = useApi(['admin', 'vault-fields', current, campusId ?? 'school'], ([, , c]) => adminVault.fieldDefinitions(campusId, c as string));

  const fieldDefs = fields.data ?? [];
  const rows = records.data ?? [];
  const refresh = () => {
    records.mutate();
    fields.mutate();
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: v('pageTitle'),
          headerRight: () => (
            <Pressable onPress={() => setCatsOpen(true)} hitSlop={8} className="p-1" accessibilityLabel={a('vt_manage_tabs')}>
              <Icon as={Settings2} className="text-foreground size-5" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10">
        <View className="flex-row items-start gap-2">
          <Icon as={Lock} className="text-primary mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{v('pageSubtitle')}</Text>
        </View>
        <FilterChips value={current} onChange={setCategory} options={all.map((c) => ({ value: c.value, label: isAr ? c.label_ar : c.label }))} />
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{records.isLoading ? v('loading') : v('recordsCount', { count: rows.length })}</Text>
          <Button size="sm" variant="outline" onPress={() => setFieldsOpen(true)}>
            <Icon as={Settings2} className="text-foreground size-4" />
            <Text>{v('manageFields')}</Text>
          </Button>
          <Button size="sm" onPress={() => setAddOpen(true)}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{v('newRecord')}</Text>
          </Button>
        </View>
        {records.isLoading ? (
          <LoadingList rows={3} />
        ) : records.error ? (
          // Without the plugin (or access) every vault endpoint answers 404 by design.
          <ErrorState message={v('notEnabled')} onRetry={() => records.mutate()} />
        ) : !rows.length ? (
          <EmptyState icon={EyeOff} title={v('noRecordsYet')} />
        ) : (
          rows.map((r) => <RecordCard key={r.id} record={r} fieldDefs={fieldDefs} onDeleted={() => records.mutate()} />)
        )}
      </ScrollView>
      {fieldsOpen ? <ManageFields open onClose={() => setFieldsOpen(false)} category={current} fieldDefs={fieldDefs} onChanged={() => fields.mutate()} /> : null}
      {addOpen ? <AddRecord open onClose={() => setAddOpen(false)} category={current} categories={all} fieldDefs={fieldDefs} onCreated={refresh} /> : null}
      <ManageCategories open={catsOpen} onClose={() => setCatsOpen(false)} categories={custom} onChanged={() => cats.mutate()} />
    </View>
  );
}
