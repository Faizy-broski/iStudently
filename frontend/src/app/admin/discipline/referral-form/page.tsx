'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getDisciplineFields,
  createDisciplineField,
  updateDisciplineField,
  deleteDisciplineField,
  type DisciplineField,
  type DisciplineFieldType,
  type DisciplineTargetType,
} from '@/lib/api/discipline';

const TARGET_TYPES: DisciplineTargetType[] = ['student', 'teacher', 'staff'];

const FIELD_TYPES: DisciplineFieldType[] = [
  'select',
  'multiple_radio',
  'multiple_checkbox',
  'text',
  'textarea',
  'checkbox',
  'numeric',
  'date',
];

const FIELD_TYPE_COLORS: Record<DisciplineFieldType, string> = {
  select: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  multiple_radio: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
  multiple_checkbox: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  text: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  textarea: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  checkbox: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  numeric: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
  date: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800',
};

const OPTIONS_TYPES: DisciplineFieldType[] = ['select', 'multiple_radio', 'multiple_checkbox'];

interface FieldFormState {
  name: string;
  field_type: DisciplineFieldType;
  options_text: string; // one option per line
  penalty: string;      // magnitude only (>= 0); sign carried separately by penaltySign
  penaltySign: '+' | '-';
  sort_order: string;
}

const emptyForm = (): FieldFormState => ({
  name: '',
  field_type: 'text',
  options_text: '',
  penalty: '',
  penaltySign: '-',
  sort_order: '0',
});

export default function ReferralFormPage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const schoolId =
    user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  // some users (super‑admins) may not have a particular school selected; the
  // discipline module is school‑scoped so we can't do anything useful in that
  // case.  watch for an empty id and show a message instead of the form.

  const [targetType, setTargetType] = useState<DisciplineTargetType>('student');
  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FieldFormState>(emptyForm());

  // Edit dialog
  const [editField, setEditField] = useState<DisciplineField | null>(null);
  const [editForm, setEditForm] = useState<FieldFormState>(emptyForm());

  useEffect(() => {
    // if there is no school selected (e.g. super‑admin viewing sandbox) we
    // should clear the previous spinner and fields rather than leaving the
    // UI in an indeterminate "loading" state.  fetchFields itself handles the
    // network call when a valid id is present.
    if (!schoolId) {
      setFields([]);
      setLoading(false);
      return;
    }

    fetchFields();
  }, [schoolId, targetType]);

  async function fetchFields() {
    setLoading(true);
    try {
      const res = await getDisciplineFields(schoolId, targetType, true);
      setFields(res.data ?? []);
    } catch {
      toast.error(t('errors.loadReferralFields'));
    } finally {
      setLoading(false);
    }
  }

  function openEdit(field: DisciplineField) {
    const pts = field.penalty_points;
    setEditField(field);
    setEditForm({
      name: field.name,
      field_type: field.field_type,
      options_text: (field.options ?? []).join('\n'),
      penalty: pts != null ? String(Math.abs(pts)) : '',
      penaltySign: pts != null && pts > 0 ? '+' : '-',
      sort_order: String(field.sort_order),
    });
  }

  function buildOptions(form: FieldFormState): string[] | null {
    if (!OPTIONS_TYPES.includes(form.field_type)) return null;
    const lines = form.options_text.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length > 0 ? lines : null;
  }

  function buildPenaltyPoints(form: FieldFormState): number | null {
    const magnitude = parseFloat(form.penalty) || 0;
    if (magnitude <= 0) return null;
    return form.penaltySign === '-' ? -magnitude : magnitude;
  }

  async function handleAdd() {
    if (!addForm.name.trim()) {
      toast.error(t('validation.fieldNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await createDisciplineField({
        school_id: schoolId,
        name: addForm.name.trim(),
        target_type: targetType,
        field_type: addForm.field_type,
        options: buildOptions(addForm),
        sort_order: parseInt(addForm.sort_order, 10) || 0,
        penalty_points: buildPenaltyPoints(addForm),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('toasts.fieldAdded'));
      setShowAdd(false);
      setAddForm(emptyForm());
      fetchFields();
    } catch {
      toast.error(t('errors.addField'));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editField || !editForm.name.trim()) {
      toast.error(t('validation.fieldNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await updateDisciplineField(editField.id, {
        name: editForm.name.trim(),
        field_type: editForm.field_type,
        options: buildOptions(editForm),
        sort_order: parseInt(editForm.sort_order, 10) || 0,
        penalty_points: buildPenaltyPoints(editForm),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('toasts.fieldUpdated'));
      setEditField(null);
      fetchFields();
    } catch {
      toast.error(t('errors.updateField'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(field: DisciplineField) {
    setDeleting(field.id);
    try {
      const res = await deleteDisciplineField(field.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('toasts.fieldDeletedWithName', { name: field.name }));
      setFields((prev) => prev.filter((f) => f.id !== field.id));
    } catch {
      toast.error(t('errors.deleteField'));
    } finally {
      setDeleting(null);
    }
  }

  async function toggleActive(field: DisciplineField) {
    try {
      const res = await updateDisciplineField(field.id, { is_active: !field.is_active });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      fetchFields();
    } catch {
      toast.error(t('errors.updateField'));
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('referralForm')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('referralFormSubtitle')}
            </p>
          </div>
          <Button onClick={() => { setShowAdd(true); setAddForm(emptyForm()); }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addField')}
          </Button>
        </div>

        {/* Target type tabs */}
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {TARGET_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTargetType(type)}
              className={cn(
                'py-1.5 px-3 rounded-md text-sm font-medium border capitalize transition-colors',
                targetType === type
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input hover:bg-muted'
              )}
            >
              {t(`targetTypes.${type}`)}
            </button>
          ))}
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
              {t('fieldsInfo')}
          </AlertDescription>
        </Alert>

        {/* Fields List */}
        {!schoolId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('noSchoolSelectedForForm')}
            </AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('loadingFields')}
          </div>
        ) : fields.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('noFieldsConfigured')} <strong>{t('addField')}</strong> {t('toGetStarted')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => (
              <Card key={field.id} className={!field.is_active ? 'opacity-60' : ''}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{field.name}</span>
                        <Badge
                          variant="outline"
                          className={FIELD_TYPE_COLORS[field.field_type]}
                        >
                          {t(`fieldTypes.${field.field_type}`)}
                        </Badge>
                        {field.penalty_points != null && (
                          field.penalty_points > 0 ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              +{field.penalty_points} pts
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              {field.penalty_points} pts
                            </Badge>
                          )
                        )}
                        {!field.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
                            {t('inactive')}
                          </Badge>
                        )}
                      </div>
                      {field.options && field.options.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {t('options')}: {field.options.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('sort_order')}: {field.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(field)}
                        className="text-xs h-7 px-2"
                      >
                        {field.is_active ? t('disable') : t('enable')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(field)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(field)}
                        disabled={deleting === field.id}
                      >
                        {deleting === field.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Field Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('addReferralFormField')}
            </DialogTitle>
          </DialogHeader>
          <FieldForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            saving={saving}
            submitLabel={t('addField')}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={!!editField} onOpenChange={(open) => { if (!open) setEditField(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {t('editField')}
            </DialogTitle>
          </DialogHeader>
          <FieldForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={handleEdit}
            onCancel={() => setEditField(null)}
            saving={saving}
            submitLabel={t('saveChanges')}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared field form component
// ---------------------------------------------------------------------------

interface FieldFormProps {
  form: FieldFormState;
  onChange: (f: FieldFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}

function FieldForm({ form, onChange, onSubmit, onCancel, saving, submitLabel }: FieldFormProps) {
  const t = useTranslations('discipline');
  const needsOptions = OPTIONS_TYPES.includes(form.field_type);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t('titleLabel')} <span className="text-destructive">*</span></Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder={t('titlePlaceholder')}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('dataType')}</Label>
        <Select
          value={form.field_type}
          onValueChange={(v) => onChange({ ...form, field_type: v as DisciplineFieldType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft} value={ft}>
                {t(`fieldTypes.${ft}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsOptions && (
        <>
          <div className="space-y-1.5">
            <Label>{t('options')} <span className="text-xs text-muted-foreground">({t('onePerLine')})</span></Label>
            <Textarea
              value={form.options_text}
              onChange={(e) => onChange({ ...form, options_text: e.target.value })}
              placeholder={'Skipping Class\nFighting\nInsubordination\nOther'}
              rows={5}
            />
          </div>

          {/* Point impact — clearly separate from the choice options */}
          <div className={cn(
            'rounded-lg border p-3 space-y-2',
            form.penaltySign === '+'
              ? 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-900/20'
              : 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/20'
          )}>
            <div className={cn(
              'flex items-center gap-1.5',
              form.penaltySign === '+' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            )}>
              {form.penaltySign === '+' ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
              <span className="text-sm font-medium">Point Impact (optional)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Points added or deducted each time a student is assigned this referral field. Leave blank or 0 for no impact.
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={form.penaltySign === '-' ? 'default' : 'outline'}
                size="sm"
                className={cn('h-8 px-3', form.penaltySign === '-' && 'bg-red-600 hover:bg-red-700 text-white')}
                onClick={() => onChange({ ...form, penaltySign: '-' })}
              >
                − Deduct
              </Button>
              <Button
                type="button"
                variant={form.penaltySign === '+' ? 'default' : 'outline'}
                size="sm"
                className={cn('h-8 px-3', form.penaltySign === '+' && 'bg-green-600 hover:bg-green-700 text-white')}
                onClick={() => onChange({ ...form, penaltySign: '+' })}
              >
                + Add
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-r-none border-r-0"
                onClick={() => onChange({...form, penalty: String(Math.max(0, parseInt(form.penalty || '0') - 1))})}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min="0"
                step="1"
                className="w-16 h-8 text-sm text-center rounded-none focus-visible:z-10"
                placeholder="0"
                value={form.penalty}
                onChange={(e) => onChange({ ...form, penalty: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="icon" 
                className="h-8 w-8 rounded-l-none border-l-0" 
                onClick={() => onChange({...form, penalty: String(parseInt(form.penalty || '0') + 1)})}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">pts per selection</span>
            </div>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label>{t('sort_order')}</Label>
        <Input
          type="number"
          value={form.sort_order}
          onChange={(e) => onChange({ ...form, sort_order: e.target.value })}
          className="w-24"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
