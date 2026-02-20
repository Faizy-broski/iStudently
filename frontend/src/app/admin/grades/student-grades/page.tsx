"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  GraduationCap,
  Users,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import * as gradesApi from "@/lib/api/grades";
import * as academicsApi from "@/lib/api/academics";
import type { GradeLevel } from "@/lib/api/academics";
import type { StudentFinalGradeEntry } from "@/lib/api/grades";

interface StudentItem {
  id: string;
  student_number: string;
  grade_level?: string | null;
  profile?: {
    first_name: string | null;
    father_name?: string | null;
    grandfather_name?: string | null;
    last_name: string | null;
  };
}

interface MarkingPeriodItem {
  id: string;
  title: string;
  short_name: string;
  mp_type: string;
}

export default function StudentGradesPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [selectedMp, setSelectedMp] = useState<string>("");

  // Student list
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected student detail
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(
    null
  );
  const [studentGrades, setStudentGrades] = useState<
    StudentFinalGradeEntry[]
  >([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // ── Load reference data ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      gradesApi.getMarkingPeriods(selectedCampus?.id),
      academicsApi.getGradeLevels(),
    ]).then(([mpRes, glRes]) => {
      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
        // Auto-select first QTR or first marking period
        const defaultMp =
          mpRes.data.find((m) => m.mp_type === "QTR") || mpRes.data[0];
        if (defaultMp) setSelectedMp(defaultMp.id);
      }
      if (glRes.success && glRes.data) {
        setGradeLevels(glRes.data);
      }
    });
  }, [user, selectedCampus?.id]);

  // ── Load students ──────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await gradesApi.getStudentsForGrades({
        campus_id: selectedCampus?.id,
        search: debouncedSearch || undefined,
        limit: 500,
      });
      if (res.success && res.data) {
        setStudents(res.data);
      }
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCampus?.id, debouncedSearch]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // ── Load student grades ────────────────────────────────────────
  const handleStudentClick = async (student: StudentItem) => {
    setSelectedStudent(student);
    setLoadingGrades(true);
    setStudentGrades([]);
    try {
      const res = await gradesApi.getStudentGrades({
        student_id: student.id,
        marking_period_id: selectedMp || undefined,
        campus_id: selectedCampus?.id,
      });
      if (res.success && res.data) {
        setStudentGrades(res.data);
      }
    } catch {
      toast.error("Failed to load grades");
    } finally {
      setLoadingGrades(false);
    }
  };

  const getStudentName = (s: StudentItem) => {
    const parts = [
      s.profile?.first_name,
      s.profile?.father_name,
      s.profile?.last_name,
    ].filter(Boolean);
    return parts.join(" ") || "Unknown";
  };

  const currentMpTitle =
    markingPeriods.find((m) => m.id === selectedMp)?.title || "All";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-[#57A3CC]" />
          Student Grades {currentMpTitle && `— ${currentMpTitle}`}
        </h1>
        <p className="text-muted-foreground mt-2">
          View student grades by marking period
          {selectedCampus && (
            <span className="ml-1 font-medium">— {selectedCampus.name}</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label className="text-sm font-medium mb-1.5 block">
                Marking Period
              </Label>
              <Select value={selectedMp} onValueChange={setSelectedMp}>
                <SelectTrigger className="w-full md:w-[250px]">
                  <SelectValue placeholder="Select marking period" />
                </SelectTrigger>
                <SelectContent>
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No students found</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#0369a1] font-medium">
                {students.length} student
                {students.length !== 1 ? "s" : ""} were found.
              </p>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                      <TableHead className="text-white font-semibold">
                        STUDENT
                      </TableHead>
                      <TableHead className="text-white font-semibold">
                        STUDENT ID
                      </TableHead>
                      <TableHead className="text-white font-semibold">
                        GRADE LEVEL
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        className={`cursor-pointer hover:bg-blue-50 ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                        onClick={() => handleStudentClick(s)}
                      >
                        <TableCell className="font-medium text-[#0369a1] hover:underline">
                          {getStudentName(s)}
                        </TableCell>
                        <TableCell>{s.student_number}</TableCell>
                        <TableCell>{s.grade_level || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Student Grades Dialog */}
      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) setSelectedStudent(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[#0369a1]" />
              {selectedStudent && getStudentName(selectedStudent)} — Grades
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {currentMpTitle} • ID: {selectedStudent?.student_number} •{" "}
              {selectedStudent?.grade_level || "—"}
            </p>
          </DialogHeader>

          <Separator />

          {loadingGrades ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : studentGrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No grades recorded for this marking period.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-semibold">Course</TableHead>
                    <TableHead className="font-semibold">Teacher</TableHead>
                    <TableHead className="font-semibold text-center">
                      %
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      Grade
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      GPA
                    </TableHead>
                    <TableHead className="font-semibold">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentGrades.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        {g.course_title}
                      </TableCell>
                      <TableCell>{g.teacher_name || "—"}</TableCell>
                      <TableCell className="text-center">
                        {g.percent_grade != null
                          ? `${Number(g.percent_grade).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {g.letter_grade || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {g.grade_points != null
                          ? Number(g.grade_points).toFixed(2)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {g.comment || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedStudent(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
