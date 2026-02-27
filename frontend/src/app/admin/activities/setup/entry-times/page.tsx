'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { getEntryTimes, saveEntryTimes, type EligibilitySettings } from '@/lib/api/activities';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export default function EntryTimesPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [settings, setSettings] = useState<EligibilitySettings>({
    school_id: schoolId,
    start_day: 0,
    start_hour: 8,
    start_minute: 0,
    end_day: 4,
    end_hour: 17,
    end_minute: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    getEntryTimes(schoolId)
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .catch(() => toast.error('Failed to load entry time settings'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveEntryTimes({ ...settings, school_id: schoolId });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Entry times saved');
    } catch {
      toast.error('Failed to save entry times');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="h-7 w-7 text-primary" />
          Entry Times
        </h1>

        <p className="text-sm text-muted-foreground">
          Configure the days and times during which teachers can enter eligibility. Outside this window, the eligibility form will be read-only.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entry Window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Start */}
            <div className="space-y-2">
              <Label className="font-medium">Start</Label>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Day</Label>
                  <Select
                    value={String(settings.start_day)}
                    onValueChange={(v) => setSettings({ ...settings, start_day: Number(v) })}
                  >
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hour</Label>
                  <Select
                    value={String(settings.start_hour)}
                    onValueChange={(v) => setSettings({ ...settings, start_hour: Number(v) })}
                  >
                    <SelectTrigger className="w-24 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>{pad2(h)}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Minute</Label>
                  <Select
                    value={String(settings.start_minute)}
                    onValueChange={(v) => setSettings({ ...settings, start_minute: Number(v) })}
                  >
                    <SelectTrigger className="w-20 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>{pad2(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* End */}
            <div className="space-y-2">
              <Label className="font-medium">End</Label>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Day</Label>
                  <Select
                    value={String(settings.end_day)}
                    onValueChange={(v) => setSettings({ ...settings, end_day: Number(v) })}
                  >
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Hour</Label>
                  <Select
                    value={String(settings.end_hour)}
                    onValueChange={(v) => setSettings({ ...settings, end_hour: Number(v) })}
                  >
                    <SelectTrigger className="w-24 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)}>{pad2(h)}:00</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Minute</Label>
                  <Select
                    value={String(settings.end_minute)}
                    onValueChange={(v) => setSettings({ ...settings, end_minute: Number(v) })}
                  >
                    <SelectTrigger className="w-20 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>{pad2(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Summary */}
            <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
              Entry window: <strong>{DAYS[settings.start_day]}</strong> at{' '}
              <strong>{pad2(settings.start_hour)}:{pad2(settings.start_minute)}</strong> through{' '}
              <strong>{DAYS[settings.end_day]}</strong> at{' '}
              <strong>{pad2(settings.end_hour)}:{pad2(settings.end_minute)}</strong>
            </p>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Save className="h-4 w-4 mr-2" />
                }
                Save Entry Times
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
