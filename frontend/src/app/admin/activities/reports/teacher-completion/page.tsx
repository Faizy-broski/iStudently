'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckSquare, Loader2, Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getTeacherCompletionReport,
  type EligibilityCompleted,
} from '@/lib/api/activities';
import { API_URL } from '@/config/api';
import { getAuthToken } from '@/lib/api/schools';

interface CoursePeriodRow {
  id: string;
  name: string;
  subject?: string;
  teacher?: string;
}

async function fetchAllCoursePeriods(schoolId: string, campusId?: string): Promise<CoursePeriodRow[]> {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({ school_id: schoolId });
    if (campusId) params.append('campus_id', campusId);
    const res = await fetch(`${API_URL}/course-periods?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default function TeacherCompletionPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const today = new Date().toISOString().slice(0, 10);
  const [schoolDate, setSchoolDate] = useState(today);

  const [coursePeriods, setCoursePeriods] = useState<CoursePeriodRow[]>([]);
  const [completed, setCompleted] = useState<EligibilityCompleted[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  async function handleGo() {
    if (!schoolId || !schoolDate) return;
    setLoading(true);
    try {
      const [cpData, compRes] = await Promise.all([
        fetchAllCoursePeriods(schoolId, campusId),
        getTeacherCompletionReport({ school_id: schoolId, school_date: schoolDate, campus_id: campusId }),
      ]);

      setCoursePeriods(cpData);
      if (compRes.error) { toast.error(compRes.error); return; }
      setCompleted(compRes.data ?? []);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const completedSet = new Set(completed.map((c) => c.course_period_id));

  const completedCount = coursePeriods.filter((cp) => completedSet.has(cp.id)).length;
  const totalCount = coursePeriods.length;

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckSquare className="h-7 w-7 text-primary" />
          Teacher Completion
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5">
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
                onClick={handleGo}
                disabled={!schoolDate || loading}
                size="sm"
                className="h-8"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Go
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasLoaded && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Completion for {schoolDate}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({completedCount}/{totalCount} course periods completed)
                  </span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="print:hidden"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {coursePeriods.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  No course periods found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Period</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Completed By</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coursePeriods.map((cp) => {
                      const comp = completed.find((c) => c.course_period_id === cp.id);
                      return (
                        <TableRow key={cp.id}>
                          <TableCell className="font-medium">{cp.name}</TableCell>
                          <TableCell className="text-muted-foreground">{cp.subject ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {comp?.staff?.full_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {comp ? (
                              <Badge className="bg-green-100 text-green-800">Completed</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600">Pending</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
