'use client';

import { useEffect, useState } from 'react';
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
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Info,
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
} from '@/lib/api/discipline';

const FIELD_TYPES: { value: DisciplineFieldType; label: string }[] = [
  { value: 'select', label: 'Pull-Down (Select One)' },
  { value: 'multiple_radio', label: 'Select One from Options (Radio)' },
  { value: 'multiple_checkbox', label: 'Select Multiple from Options (Checkbox)' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'checkbox', label: 'Checkbox (Yes/No)' },
  { value: 'numeric', label: 'Number' },
  { value: 'date', label: 'Date' },
];

const FIELD_TYPE_LABELS: Record<DisciplineFieldType, string> = {
  select: 'Pull-Down',
  multiple_radio: 'Select One',
  multiple_checkbox: 'Select Multiple',
  text: 'Text',
  textarea: 'Long Text',
  checkbox: 'Checkbox',
  numeric: 'Number',
  date: 'Date',
};

const FIELD_TYPE_COLORS: Record<DisciplineFieldType, string> = {
  select: 'bg-blue-100 text-blue-800',
  multiple_radio: 'bg-purple-100 text-purple-800',
  multiple_checkbox: 'bg-indigo-100 text-indigo-800',
  text: 'bg-gray-100 text-gray-700',
  textarea: 'bg-gray-100 text-gray-700',
  checkbox: 'bg-green-100 text-green-800',
  numeric: 'bg-orange-100 text-orange-800',
  date: 'bg-cyan-100 text-cyan-800',
};

const OPTIONS_TYPES: DisciplineFieldType[] = ['select', 'multiple_radio', 'multiple_checkbox'];

interface FieldFormState {
  name: string;
  field_type: DisciplineFieldType;
  options_text: string; // one option per line
  sort_order: string;
}

const emptyForm = (): FieldFormState => ({
  name: '',
  field_type: 'text',
  options_text: '',
  sort_order: '0',
});

export default function ReferralFormPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const schoolId =
    user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  // some users (super‑admins) may not have a particular school selected; the
  // discipline module is school‑scoped so we can't do anything useful in that
  // case.  watch for an empty id and show a message instead of the form.

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
  }, [schoolId]);

  async function fetchFields() {
    setLoading(true);
    try {
      const res = await getDisciplineFields(schoolId, true);
      setFields(res.data ?? []);
    } catch {
      toast.error('Failed to load referral form fields');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(field: DisciplineField) {
    setEditField(field);
    setEditForm({
      name: field.name,
      field_type: field.field_type,
      options_text: (field.options ?? []).join('\n'),
      sort_order: String(field.sort_order),
    });
  }

  function parseOptions(text: string): string[] | null {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.length > 0 ? lines : null;
  }

  async function handleAdd() {
    if (!addForm.name.trim()) {
      toast.error('Field name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await createDisciplineField({
        school_id: schoolId,
        name: addForm.name.trim(),
        field_type: addForm.field_type,
        options: OPTIONS_TYPES.includes(addForm.field_type) ? parseOptions(addForm.options_text) : null,
        sort_order: parseInt(addForm.sort_order, 10) || 0,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Field added');
      setShowAdd(false);
      setAddForm(emptyForm());
      fetchFields();
    } catch {
      toast.error('Failed to add field');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editField || !editForm.name.trim()) {
      toast.error('Field name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await updateDisciplineField(editField.id, {
        name: editForm.name.trim(),
        field_type: editForm.field_type,
        options: OPTIONS_TYPES.includes(editForm.field_type) ? parseOptions(editForm.options_text) : null,
        sort_order: parseInt(editForm.sort_order, 10) || 0,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Field updated');
      setEditField(null);
      fetchFields();
    } catch {
      toast.error('Failed to update field');
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
      toast.success(`"${field.name}" deleted`);
      setFields((prev) => prev.filter((f) => f.id !== field.id));
    } catch {
      toast.error('Failed to delete field');
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
      toast.error('Failed to update field');
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Referral Form</h1>
            <p className="text-muted-foreground mt-1">
              Configure custom fields that appear on discipline referrals.
            </p>
          </div>
          <Button onClick={() => { setShowAdd(true); setAddForm(emptyForm()); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Fields are school-wide and apply to all campuses. They appear in the "Add Referral"
            form in the order you specify. Fields with options (Select, Radio, Checkbox) require
            you to enter one option per line.
          </AlertDescription>
        </Alert>

        {/* Fields List */}
        {!schoolId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              No school selected. You may be a super‑admin – pick a campus from the
              header dropdown to establish a school context before configuring the
              referral form.
            </AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading fields…
          </div>
        ) : fields.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No fields configured yet. Click <strong>Add Field</strong> to get started.
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
                          {FIELD_TYPE_LABELS[field.field_type]}
                        </Badge>
                        {!field.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {field.options && field.options.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Options: {field.options.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Sort order: {field.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(field)}
                        className="text-xs h-7 px-2"
                      >
                        {field.is_active ? 'Disable' : 'Enable'}
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
              Add Referral Form Field
            </DialogTitle>
          </DialogHeader>
          <FieldForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            saving={saving}
            submitLabel="Add Field"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={!!editField} onOpenChange={(open) => { if (!open) setEditField(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Field
            </DialogTitle>
          </DialogHeader>
          <FieldForm
            form={editForm}
            onChange={setEditForm}
            onSubmit={handleEdit}
            onCancel={() => setEditField(null)}
            saving={saving}
            submitLabel="Save Changes"
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
  const needsOptions = OPTIONS_TYPES.includes(form.field_type);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Violation, Detention Assigned"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Data Type</Label>
        <Select
          value={form.field_type}
          onValueChange={(v) => onChange({ ...form, field_type: v as DisciplineFieldType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>
                {ft.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsOptions && (
        <div className="space-y-1.5">
          <Label>Options <span className="text-xs text-muted-foreground">(one per line)</span></Label>
          <Textarea
            value={form.options_text}
            onChange={(e) => onChange({ ...form, options_text: e.target.value })}
            placeholder={'Skipping Class\nFighting\nInsubordination\nOther'}
            rows={5}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Sort Order</Label>
        <Input
          type="number"
          value={form.sort_order}
          onChange={(e) => onChange({ ...form, sort_order: e.target.value })}
          className="w-24"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
