'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ClipboardCheck, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { saveEligibility, getEligibility, type EligibilityCode } from '@/lib/api/activities';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/api/schools';

const ELIGIBILITY_CODES: EligibilityCode[] = ['PASSING', 'BORDERLINE', 'FAILING', 'INCOMPLETE'];

const ELIGIBILITY_COLORS: Record<EligibilityCode, string> = {
  PASSING: 'bg-green-100 text-green-800',
  BORDERLINE: 'bg-yellow-100 text-yellow-800',
  FAILING: 'bg-red-100 text-red-800',
  INCOMPLETE: 'bg-gray-100 text-gray-700',
};

interface CoursePeriod {
  id: string;
  displayName: string;
}

interface StudentRow {
  student_id: string;
  name: string;
  student_number: string;
  eligibility_code: EligibilityCode;
}

// Course periods endpoint only accepts campus_id (no school_id param)
async function fetchCoursePeriods(campusId?: string): Promise<CoursePeriod[]> {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', campusId);
    const res = await fetch(`${API_URL}/course-periods${params.toString() ? '?' + params : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: any[] = data.data ?? [];
    return raw.map((cp) => {
      const periodName = cp.period?.period_name ?? '';
      const courseTitle = cp.course?.title ?? cp.title ?? '';
      const teacherName = cp.teacher?.profile
        ? `${cp.teacher.profile.last_name}`
        : '';
      const label = [periodName, courseTitle, teacherName ? `(${teacherName})` : '']
        .filter(Boolean)
        .join(' ');
      return { id: cp.id, displayName: label || cp.id };
    });
  } catch {
    return [];
  }
}

// Fetch all students for the school/campus
async function fetchStudents(schoolId: string, campusId?: string): Promise<any[]> {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({ school_id: schoolId, limit: '500' });
    if (campusId) params.append('campus_id', campusId);
    const res = await fetch(`${API_URL}/students?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default function EnterEligibilityPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const today = new Date().toISOString().slice(0, 10);

  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [schoolDate, setSchoolDate] = useState(today);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    fetchCoursePeriods(campusId)
      .then(setCoursePeriods)
      .finally(() => setLoadingPeriods(false));
  }, [campusId]);

  async function handleLoad() {
    if (!schoolId || !selectedPeriodId || !schoolDate) return;
    setLoading(true);
    try {
      // Fetch all students for the campus
      const students = await fetchStudents(schoolId, campusId);

      // Fetch existing eligibility records for this period + date
      const eligRes = await getEligibility({
        school_id: schoolId,
        course_period_id: selectedPeriodId,
        school_date: schoolDate,
        campus_id: campusId,
      });
      const existing = eligRes.data ?? [];
      const existingMap: Record<string, EligibilityCode> = {};
      for (const e of existing) existingMap[e.student_id] = e.eligibility_code;

      const studentRows: StudentRow[] = students.map((s: any) => {
        // build display name; include father/grandfather if present in profile
        const prof = s.profile || {};
        const first = s.first_name || prof.first_name || '';
        const father = prof.father_name || '';
        const last = s.last_name || prof.last_name || '';
        const nameParts = [first];
        if (father) nameParts.push(father);
        if (last) nameParts.push(last);
        return {
          student_id: s.id,
          name: nameParts.join(' ').trim(),
          student_number: s.student_number ?? '',
          eligibility_code: existingMap[s.id] ?? 'PASSING',
        };
      });

      studentRows.sort((a, b) => a.name.localeCompare(b.name));
      setRows(studentRows);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }

  function setCode(studentId: string, code: EligibilityCode) {
    setRows((prev) =>
      prev.map((r) => r.student_id === studentId ? { ...r, eligibility_code: code } : r)
    );
  }

  function setAllCodes(code: EligibilityCode) {
    setRows((prev) => prev.map((r) => ({ ...r, eligibility_code: code })));
  }

  async function handleSave() {
    if (!schoolId || !selectedPeriodId || !schoolDate || rows.length === 0) return;
    setSaving(true);
    try {
      const res = await saveEligibility({
        school_id: schoolId,
        campus_id: campusId || null,
        course_period_id: selectedPeriodId,
        school_date: schoolDate,
        records: rows.map((r) => ({ student_id: r.student_id, eligibility_code: r.eligibility_code })),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Eligibility saved');
    } catch {
      toast.error('Failed to save eligibility');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          Enter Eligibility
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            {/* Course Period */}
            <div className="space-y-1.5">
              <Label>Course Period</Label>
              {loadingPeriods ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading course periods…
                </div>
              ) : (
                <Select value={selectedPeriodId || '__none__'} onValueChange={(v) => setSelectedPeriodId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Select a course period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select —</SelectItem>
                    {coursePeriods.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No course periods found{!campusId ? ' — select a campus first' : ''}
                      </div>
                    ) : (
                      coursePeriods.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.displayName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date + Load */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={schoolDate}
                  onChange={(e) => setSchoolDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <Button
                onClick={handleLoad}
                disabled={!selectedPeriodId || !schoolDate || loading}
                size="sm"
                className="h-8"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Load Students
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasLoaded && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">
                  Students ({rows.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Set all:</span>
                  {ELIGIBILITY_CODES.map((code) => (
                    <Button
                      key={code}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setAllCodes(code)}
                    >
                      {code}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  No students found.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead className="w-52">Eligibility</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.student_id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.student_number}</TableCell>
                          <TableCell>
                            <Select
                              value={row.eligibility_code}
                              onValueChange={(v) => setCode(row.student_id, v as EligibilityCode)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ELIGIBILITY_CODES.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ELIGIBILITY_COLORS[code]}`}>
                                      {code}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Save className="h-4 w-4 mr-2" />
                      }
                      Save Eligibility
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
