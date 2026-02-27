'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Settings, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  type Activity,
} from '@/lib/api/activities';

interface ActivityForm {
  title: string;
  start_date: string;
  end_date: string;
  comment: string;
}

const emptyForm = (): ActivityForm => ({
  title: '',
  start_date: '',
  end_date: '',
  comment: '',
});

export default function ActivitiesSetupPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<ActivityForm>(emptyForm());

  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState<ActivityForm>(emptyForm());

  useEffect(() => {
    if (!schoolId) return;
    fetchActivities();
  }, [schoolId, campusId]);

  async function fetchActivities() {
    setLoading(true);
    try {
      const res = await getActivities({ school_id: schoolId, campus_id: campusId, include_inactive: true });
      setActivities(res.data ?? []);
    } catch {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }

  function openEdit(activity: Activity) {
    setEditActivity(activity);
    setEditForm({
      title: activity.title,
      start_date: activity.start_date ?? '',
      end_date: activity.end_date ?? '',
      comment: activity.comment ?? '',
    });
  }

  async function handleAdd() {
    if (!addForm.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await createActivity({
        school_id: schoolId,
        campus_id: campusId || null,
        title: addForm.title.trim(),
        start_date: addForm.start_date || null,
        end_date: addForm.end_date || null,
        comment: addForm.comment || null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Activity added');
      setShowAdd(false);
      setAddForm(emptyForm());
      fetchActivities();
    } catch {
      toast.error('Failed to add activity');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editActivity || !editForm.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await updateActivity(editActivity.id, {
        title: editForm.title.trim(),
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        comment: editForm.comment || null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Activity updated');
      setEditActivity(null);
      fetchActivities();
    } catch {
      toast.error('Failed to update activity');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(activity: Activity) {
    setDeletingId(activity.id);
    try {
      const res = await deleteActivity(activity.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`"${activity.title}" deleted`);
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    } catch {
      toast.error('Failed to delete activity');
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(activity: Activity) {
    try {
      const res = await updateActivity(activity.id, { is_active: !activity.is_active });
      if (res.error) { toast.error(res.error); return; }
      fetchActivities();
    } catch {
      toast.error('Failed to update activity');
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activities</h1>
            <p className="text-muted-foreground mt-1">Configure activities for the eligibility module.</p>
          </div>
          <Button onClick={() => { setShowAdd(true); setAddForm(emptyForm()); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : activities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No activities configured yet. Click <strong>Add Activity</strong> to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Card key={activity.id} className={!activity.is_active ? 'opacity-60' : ''}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{activity.title}</span>
                        {!activity.is_active && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 mt-0.5">
                        {(activity.start_date || activity.end_date) && (
                          <p className="text-xs text-muted-foreground">
                            {activity.start_date ?? '—'} → {activity.end_date ?? '—'}
                          </p>
                        )}
                        {activity.comment && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{activity.comment}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(activity)}
                        className="text-xs h-7 px-2"
                      >
                        {activity.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(activity)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(activity)}
                        disabled={deletingId === activity.id}
                      >
                        {deletingId === activity.id
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

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Add Activity
            </DialogTitle>
          </DialogHeader>
          <ActivityFormFields form={addForm} onChange={setAddForm} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} submitLabel="Add Activity" />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editActivity} onOpenChange={(open) => { if (!open) setEditActivity(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Activity
            </DialogTitle>
          </DialogHeader>
          <ActivityFormFields form={editForm} onChange={setEditForm} onSubmit={handleEdit} onCancel={() => setEditActivity(null)} saving={saving} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FieldProps {
  form: ActivityForm;
  onChange: (f: ActivityForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}

function ActivityFormFields({ form, onChange, onSubmit, onCancel, saving, submitLabel }: FieldProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          placeholder="e.g. Basketball, Chess Club"
        />
      </div>
      <div className="flex gap-3">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => onChange({ ...form, start_date: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={form.end_date}
            onChange={(e) => onChange({ ...form, end_date: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Comment</Label>
        <Textarea
          value={form.comment}
          onChange={(e) => onChange({ ...form, comment: e.target.value })}
          placeholder="Optional notes…"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
