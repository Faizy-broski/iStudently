'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import { Users, Loader2, Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import {
  getActivities,
  getStudentListReport,
  type Activity,
  type StudentListReportRow,
  type EligibilityCode,
} from '@/lib/api/activities';

const ELIGIBILITY_COLORS: Record<EligibilityCode, string> = {
  PASSING: 'bg-green-100 text-green-800',
  BORDERLINE: 'bg-yellow-100 text-yellow-800',
  FAILING: 'bg-red-100 text-red-800',
  INCOMPLETE: 'bg-gray-100 text-gray-700',
};

function overallEligibility(records: StudentListReportRow['eligibility_records']): EligibilityCode {
  const codes = records.map((r) => r.eligibility_code);
  if (codes.includes('FAILING')) return 'FAILING';
  if (codes.includes('INCOMPLETE')) return 'INCOMPLETE';
  if (codes.includes('BORDERLINE')) return 'BORDERLINE';
  if (codes.length === 0) return 'PASSING';
  return 'PASSING';
}

export default function StudentListReportPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState('');

  const [rows, setRows] = useState<StudentListReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!schoolId) { setLoadingActivities(false); return; }
    getActivities({ school_id: schoolId, campus_id: campusId })
      .then((res) => setActivities(res.data ?? []))
      .catch(() => toast.error('Failed to load activities'))
      .finally(() => setLoadingActivities(false));
  }, [schoolId, campusId]);

  async function handleGo() {
    if (!schoolId || !selectedActivityId) return;
    setLoading(true);
    try {
      const res = await getStudentListReport({
        school_id: schoolId,
        activity_id: selectedActivityId,
        campus_id: campusId,
      });
      if (res.error) { toast.error(res.error); return; }
      const sorted = (res.data ?? []).sort((a, b) => {
        const an = a.student ? `${a.student.last_name} ${a.student.first_name}` : '';
        const bn = b.student ? `${b.student.last_name} ${b.student.first_name}` : '';
        return an.localeCompare(bn);
      });
      setRows(sorted);
      setHasLoaded(true);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);

  // Collect all unique course period IDs from the data
  const allPeriods = Array.from(
    new Set(rows.flatMap((r) => r.eligibility_records.map((e) => e.course_period_id)))
  ).sort();

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" />
          Student List
        </h1>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>Activity</Label>
                {loadingActivities ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select an activity" />
                    </SelectTrigger>
                    <SelectContent>
                      {activities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                onClick={handleGo}
                disabled={!selectedActivityId || loading}
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
                  {selectedActivity?.title ?? 'Activity'} — Student List
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({rows.length} student{rows.length !== 1 ? 's' : ''})
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
              {rows.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  No students enrolled in this activity.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-center">Overall Eligibility</TableHead>
                        <TableHead className="text-center">Records</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => {
                        const overall = overallEligibility(row.eligibility_records);
                        return (
                          <TableRow key={row.student?.id ?? i}>
                            <TableCell className="font-medium">
                              {row.student
                                ? `${row.student.last_name}, ${row.student.first_name}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.student?.student_number ?? '—'}
                            </TableCell>
                            <TableCell>{row.student?.grade_level ?? '—'}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={ELIGIBILITY_COLORS[overall]}>
                                {overall}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground text-sm">
                              {row.eligibility_records.length}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
