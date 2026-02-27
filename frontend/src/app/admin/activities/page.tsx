'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Star, Loader2, Search, ChevronLeft, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getActivities,
  getActivityStudents,
  enrollStudents,
  unenrollStudent,
  type Activity,
  type StudentActivity,
} from '@/lib/api/activities';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/api/schools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchStudents(schoolId: string, campusId?: string, search?: string): Promise<any[]> {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({ school_id: schoolId, limit: '200' });
    if (campusId) params.append('campus_id', campusId);
    if (search) params.append('search', search);
    const res = await fetch(`${API_URL}/students?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function fetchStudentActivities(studentId: string, schoolId: string): Promise<any[]> {
  // Returns all activities the student is enrolled in
  try {
    const token = await getAuthToken();
    const res = await fetch(`${API_URL}/student-activities?student_id=${studentId}&school_id=${schoolId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Fallback: query student_activities through activities enrolled list
    // We'll use a different approach - check each activity
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

interface StudentListViewProps {
  schoolId: string;
  campusId?: string;
  onSelectStudent: (student: any) => void;
}

function StudentListView({ schoolId, campusId, onSelectStudent }: StudentListViewProps) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleSearch() {
    setLoading(true);
    try {
      const data = await fetchStudents(schoolId, campusId, search || undefined);
      setStudents(data);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (schoolId) handleSearch();
  }, [schoolId, campusId]);

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {hasLoaded ? `${students.length} student${students.length !== 1 ? 's' : ''} found` : ''}
        </span>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-48 h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !hasLoaded ? (
            <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
            </div>
          ) : students.length === 0 && hasLoaded ? (
            <p className="text-center py-10 text-sm text-muted-foreground">No students found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Istudently ID</TableHead>
                  <TableHead>Grade Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <button
                        className="text-primary hover:underline font-medium text-left"
                        onClick={() => onSelectStudent(s)}
                      >
                        {
                          // prefer flattened fields but fall back to profile object if needed
                          `${s.first_name || s?.profile?.first_name || ''} ${s.last_name || s?.profile?.last_name || ''}`.trim()
                        }
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.student_number}</TableCell>
                    <TableCell>{s.grade_level ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Detail View
// ---------------------------------------------------------------------------

interface StudentDetailViewProps {
  student: any;
  schoolId: string;
  campusId?: string;
  onBack: () => void;
}

function StudentDetailView({ student, schoolId, campusId, onBack }: StudentDetailViewProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [enrolled, setEnrolled] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addActivityId, setAddActivityId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [student.id]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch all available activities
      const { getActivities: fetchAll } = await import('@/lib/api/activities');
      const allRes = await fetchAll({ school_id: schoolId, campus_id: campusId });
      const allActivities = allRes.data ?? [];
      setActivities(allActivities);

      // Find which activities this student is enrolled in by checking each activity's enrollment
      const enrolledActivities: Activity[] = [];
      for (const act of allActivities) {
        const studRes = await getActivityStudents(act.id);
        const students = studRes.data ?? [];
        if (students.some((s: StudentActivity) => s.student_id === student.id)) {
          enrolledActivities.push(act);
        }
      }
      setEnrolled(enrolledActivities);
    } catch {
      toast.error('Failed to load student activities');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!addActivityId) return;
    setAdding(true);
    try {
      const res = await enrollStudents(addActivityId, {
        student_ids: [student.id],
        school_id: schoolId,
        campus_id: campusId || null,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Student added to activity');
      setAddActivityId('');
      loadData();
    } catch {
      toast.error('Failed to add activity');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(activityId: string) {
    setRemovingId(activityId);
    try {
      const res = await unenrollStudent(activityId, student.id);
      if (res.error) { toast.error(res.error); return; }
      toast.success('Removed from activity');
      setEnrolled((prev) => prev.filter((a) => a.id !== activityId));
    } catch {
      toast.error('Failed to remove activity');
    } finally {
      setRemovingId(null);
    }
  }

  // always present all activities, but disable those the student already has
  const enrolledIds = new Set(enrolled.map((e) => e.id));

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to all students
      </button>

      <p className="text-lg font-semibold">
        {student.first_name} {student.last_name}
        <span className="ml-2 text-sm font-normal text-muted-foreground">#{student.student_number}</span>
      </p>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2 text-sm text-muted-foreground border-b">
              {enrolled.length} activit{enrolled.length !== 1 ? 'ies' : 'y'} found
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Starts</TableHead>
                  <TableHead>Ends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrolled.map((act) => (
                  <TableRow key={act.id}>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(act.id)}
                        disabled={removingId === act.id}
                      >
                        {removingId === act.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Minus className="h-3 w-3" />
                        }
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{act.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {act.start_date
                        ? new Date(act.start_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {act.end_date
                        ? new Date(act.end_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Add row */}
                <TableRow>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 text-primary border-primary hover:bg-primary/10"
                      onClick={handleAdd}
                      disabled={!addActivityId || adding}
                    >
                      {adding
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Plus className="h-3 w-3" />
                      }
                    </Button>
                  </TableCell>
                  <TableCell colSpan={3}>
                    <div className="flex items-center gap-2">
                      <Select value={addActivityId || '__none__'} onValueChange={(v) => setAddActivityId(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="h-7 w-48 text-xs">
                          <SelectValue placeholder="Select activity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">N/A</SelectItem>
                          {activities.map((a) => (
                            <SelectItem
                              key={a.id}
                              value={a.id}
                              disabled={enrolledIds.has(a.id)}
                            >
                              {a.title}{enrolledIds.has(a.id) ? ' (enrolled)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={handleAdd}
                        disabled={!addActivityId || adding}
                      >
                        ADD
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivitiesStudentScreen() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Star className="h-7 w-7 text-primary" />
          Student Screen
        </h1>

        {selectedStudent ? (
          <StudentDetailView
            student={selectedStudent}
            schoolId={schoolId}
            campusId={campusId}
            onBack={() => setSelectedStudent(null)}
          />
        ) : (
          <StudentListView
            schoolId={schoolId}
            campusId={campusId}
            onSelectStudent={setSelectedStudent}
          />
        )}

      </div>
    </div>
  );
}
