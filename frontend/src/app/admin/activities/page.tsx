'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

interface ActivityStudentProfile {
  first_name?: string | null;
  last_name?: string | null;
}

interface ActivityStudent {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  student_number?: string | null;
  grade_level?: string | null;
  profile?: ActivityStudentProfile | null;
}

async function fetchStudents(schoolId: string, campusId?: string, search?: string): Promise<ActivityStudent[]> {
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

interface StudentListViewProps {
  schoolId: string;
  campusId?: string;
  onSelectStudent: (student: ActivityStudent) => void;
}

function StudentListView({ schoolId, campusId, onSelectStudent }: StudentListViewProps) {
  const t = useTranslations('activities');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<ActivityStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const runSearch = useCallback(async (searchValue?: string) => {
    setLoading(true);
    try {
      const data = await fetchStudents(schoolId, campusId, searchValue);
      setStudents(data);
      setHasLoaded(true);
    } catch {
      toast.error(t('failedToLoadStudents'));
    } finally {
      setLoading(false);
    }
  }, [campusId, schoolId, t]);

  const handleSearch = useCallback(() => {
    void runSearch(search || undefined);
  }, [runSearch, search]);

  useEffect(() => {
    if (schoolId) {
      void runSearch();
    }
  }, [runSearch, schoolId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {hasLoaded ? t('studentsFound', { count: students.length }) : ''}
        </span>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
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
              <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingStudents')}
            </div>
          ) : students.length === 0 && hasLoaded ? (
            <p className="text-center py-10 text-sm text-muted-foreground">{t('noStudentsFound')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('studentLabel')}</TableHead>
                  <TableHead>{t('studentTableId')}</TableHead>
                  <TableHead>{t('gradeLevel')}</TableHead>
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
                        {`${s.first_name || s?.profile?.first_name || ''} ${s.last_name || s?.profile?.last_name || ''}`.trim()}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.student_number}</TableCell>
                    <TableCell>{s.grade_level ?? '-'}</TableCell>
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

interface StudentDetailViewProps {
  student: ActivityStudent;
  schoolId: string;
  campusId?: string;
  onBack: () => void;
}

function StudentDetailView({ student, schoolId, campusId, onBack }: StudentDetailViewProps) {
  const t = useTranslations('activities');
  const locale = useLocale();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [enrolled, setEnrolled] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addActivityId, setAddActivityId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allRes = await getActivities({ school_id: schoolId, campus_id: campusId });
      const allActivities = allRes.data ?? [];
      setActivities(allActivities);

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
      toast.error(t('failedToLoadStudentActivities'));
    } finally {
      setLoading(false);
    }
  }, [campusId, schoolId, student.id, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleAdd() {
    if (!addActivityId) return;
    setAdding(true);
    try {
      const res = await enrollStudents(addActivityId, {
        student_ids: [student.id],
        school_id: schoolId,
        campus_id: campusId || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('studentAddedToActivity'));
      setAddActivityId('');
      void loadData();
    } catch {
      toast.error(t('failedToAddActivityToStudent'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(activityId: string) {
    setRemovingId(activityId);
    try {
      const res = await unenrollStudent(activityId, student.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t('removedFromActivity'));
      setEnrolled((prev) => prev.filter((a) => a.id !== activityId));
    } catch {
      toast.error(t('failedToRemoveActivity'));
    } finally {
      setRemovingId(null);
    }
  }

  const enrolledIds = new Set(enrolled.map((e) => e.id));

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('backToAllStudents')}
      </button>

      <p className="text-lg font-semibold">
        {student.first_name} {student.last_name}
        <span className="ml-2 text-sm font-normal text-muted-foreground">#{student.student_number}</span>
      </p>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingActivities')}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2 text-sm text-muted-foreground border-b">
              {t('activitiesFound', { count: enrolled.length })}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t('activity')}</TableHead>
                  <TableHead>{t('starts')}</TableHead>
                  <TableHead>{t('ends')}</TableHead>
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
                    <TableCell className="text-muted-foreground">{formatDate(act.start_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(act.end_date)}</TableCell>
                  </TableRow>
                ))}

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
                          <SelectValue placeholder={t('selectActivityPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('notApplicable')}</SelectItem>
                          {activities.map((a) => (
                            <SelectItem
                              key={a.id}
                              value={a.id}
                              disabled={enrolledIds.has(a.id)}
                            >
                              {enrolledIds.has(a.id)
                                ? t('activityOptionEnrolled', { title: a.title })
                                : a.title}
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
                        {t('addShort')}
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

export default function ActivitiesStudentScreen() {
  const t = useTranslations('activities');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [selectedStudent, setSelectedStudent] = useState<ActivityStudent | null>(null);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Star className="h-7 w-7 text-primary" />
          {t('studentScreen')}
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
