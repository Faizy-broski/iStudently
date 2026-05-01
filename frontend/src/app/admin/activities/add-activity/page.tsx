'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { UserPlus, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getActivities,
  enrollStudents,
  type Activity,
} from '@/lib/api/activities';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/api/schools';

async function fetchAllStudents(schoolId: string, campusId?: string): Promise<any[]> {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({ school_id: schoolId, limit: '500' });
    if (campusId) params.append('campus_id', campusId);
    const res = await fetch(`${API_URL}/students?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default function AddActivityPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState('__none__');

  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) { setLoadingActivities(false); return; }
    getActivities({ school_id: schoolId, campus_id: campusId })
      .then((res) => setActivities(res.data ?? []))
      .catch(() => toast.error('Failed to load activities'))
      .finally(() => setLoadingActivities(false));
  }, [schoolId, campusId]);

  useEffect(() => {
    if (!schoolId) { setLoadingStudents(false); return; }
    fetchAllStudents(schoolId, campusId)
      .then(setStudents)
      .finally(() => setLoadingStudents(false));
  }, [schoolId, campusId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.student_number?.toLowerCase().includes(q)
    );
  }, [students, search]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  }

  async function handleAddToSelected() {
    const activityId = selectedActivityId === '__none__' ? '' : selectedActivityId;
    if (!activityId) { toast.error('Please select an activity'); return; }
    if (selected.size === 0) { toast.error('Please select at least one student'); return; }

    setSaving(true);
    try {
      const res = await enrollStudents(activityId, {
        student_ids: Array.from(selected),
        school_id: schoolId,
        campus_id: campusId || null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${selected.size} student${selected.size !== 1 ? 's' : ''} added to activity`);
      setSelected(new Set());
    } catch {
      toast.error('Failed to add students to activity');
    } finally {
      setSaving(false);
    }
  }

  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const someChecked = !allChecked && filtered.some((s) => selected.has(s.id));

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-7 w-7 text-primary" />
            Add Activity
          </h1>
          <Button
            onClick={handleAddToSelected}
            disabled={saving || selected.size === 0 || selectedActivityId === '__none__'}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            ADD ACTIVITY TO SELECTED STUDENTS
          </Button>
        </div>

        {/* Activity selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Activity</Label>
                {loadingActivities ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                    <SelectTrigger className="w-56 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">N/A</SelectItem>
                      {activities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student table */}
        <Card>
          <CardContent className="p-0">
            {/* Table header row */}
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="text-sm text-muted-foreground">
                {loadingStudents
                  ? 'Loading students…'
                  : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} found`}
                {selected.size > 0 && (
                  <span className="ml-2 text-primary font-medium">({selected.size} selected)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-40 h-7 text-sm"
                />
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {loadingStudents ? (
              <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allChecked}
                        data-state={someChecked ? 'indeterminate' : undefined}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Istudently ID</TableHead>
                    <TableHead>Grade Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => toggleOne(s.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(s.id)}
                            onCheckedChange={() => toggleOne(s.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.first_name} {s.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.student_number}</TableCell>
                        <TableCell>{s.grade_level ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Bottom action button */}
        {filtered.length > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={handleAddToSelected}
              disabled={saving || selected.size === 0 || selectedActivityId === '__none__'}
              className="px-8"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              ADD ACTIVITY TO SELECTED STUDENTS
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
