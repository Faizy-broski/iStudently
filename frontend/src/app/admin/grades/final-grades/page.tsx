"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckSquare, Users, ClipboardList, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import * as academicsApi from "@/lib/api/academics";
import type { GradeLevel } from "@/lib/api/academics";
import { printReportCards, type ReportCardData } from "@/components/grades/ReportPrintPreview";

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

export default function FinalGradesPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Include options ───────────────────────────────────────────
  const [includeTeacher, setIncludeTeacher] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includePercents, setIncludePercents] = useState(false);
  const [includeMinMaxGrades, setIncludeMinMaxGrades] = useState(false);

  // ── Attendance options ────────────────────────────────────────
  const [includeYtdAbsences, setIncludeYtdAbsences] = useState(true);
  const [includeOtherAttendanceYtd, setIncludeOtherAttendanceYtd] =
    useState(false);
  const [otherAttendanceYtdType, setOtherAttendanceYtdType] =
    useState("Absent");
  const [includeMpAbsences, setIncludeMpAbsences] = useState(true);
  const [includeOtherAttendanceMp, setIncludeOtherAttendanceMp] =
    useState(false);
  const [otherAttendanceMpType, setOtherAttendanceMpType] = useState("Absent");
  const [includePeriodAbsences, setIncludePeriodAbsences] = useState(false);

  // ── Marking periods ───────────────────────────────────────────
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [selectedMpIds, setSelectedMpIds] = useState<string[]>([]);

  // ── Students ──────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);


  // ── Expanded / Group toggles ──────────────────────────────────
  const [expandedView, setExpandedView] = useState(false);

  // ── Load data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [studentsRes, mpRes, glRes] = await Promise.all([
        gradesApi.getStudentsForGrades({
          campus_id: selectedCampus?.id,
          grade_level: gradeFilter !== "all" ? gradeFilter : undefined,
          limit: 500,
        }),
        gradesApi.getMarkingPeriods(selectedCampus?.id),
        academicsApi.getGradeLevels(),
      ]);

      if (studentsRes.success && studentsRes.data) {
        setStudents(studentsRes.data);
        setSelectedStudentIds(studentsRes.data.map((s) => s.id));
      }
      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
      }
      if (glRes.success && glRes.data) {
        setGradeLevels(glRes.data);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCampus?.id, gradeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ──────────────────────────────────────────────────
  const toggleMp = (id: string) => {
    setSelectedMpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
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

  const handleGenerate = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student");
      return;
    }
    if (selectedMpIds.length === 0) {
      toast.error("Please select at least one marking period");
      return;
    }

    setGenerating(true);
    try {
      const res = await gradesApi.generateFinalGradeLists({
        student_ids: selectedStudentIds,
        marking_period_ids: selectedMpIds,
        campus_id: selectedCampus?.id,
        options: {
          include_teacher: includeTeacher,
          include_comments: includeComments,
          include_percents: includePercents,
          include_min_max_grades: includeMinMaxGrades,
          include_ytd_absences: includeYtdAbsences,
          include_other_attendance_ytd: includeOtherAttendanceYtd,
          other_attendance_ytd_type: otherAttendanceYtdType,
          include_mp_absences: includeMpAbsences,
          include_other_attendance_mp: includeOtherAttendanceMp,
          other_attendance_mp_type: otherAttendanceMpType,
          include_period_absences: includePeriodAbsences,
        },
      });

      if (res.success) {
        const cards = res.data?.grade_lists || res.data?.data?.grade_lists || [];
        if (cards.length > 0) {
          printReportCards("Final Grade List", cards as ReportCardData[]);
        } else {
          toast.success(
            `Grade lists created for ${selectedStudentIds.length} student(s)`
          );
        }
      } else {
        toast.error(res.error || "Failed to create grade lists");
      }
    } catch {
      toast.error("Failed to create grade lists");
    } finally {
      setGenerating(false);
    }
  };

  // Quarters only (as shown in screenshot)
  const quarterPeriods = markingPeriods.filter((mp) => mp.mp_type === "QTR");

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-[#57A3CC]" />
            Final Grades
          </h1>
          <p className="text-muted-foreground mt-2">
            Create grade lists for selected students
            {selectedCampus && (
              <span className="ml-1 font-medium">
                — {selectedCampus.name}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={
            generating ||
            selectedStudentIds.length === 0 ||
            selectedMpIds.length === 0
          }
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-5 py-2.5"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ClipboardList className="h-4 w-4 mr-2" />
          )}
          Create Grade Lists for Selected Students
        </Button>
      </div>

      {/* View toggles */}
      <div className="flex gap-3 text-sm">
        <button
          onClick={() => setExpandedView(!expandedView)}
          className="text-[#0369a1] hover:underline font-medium"
        >
          {expandedView ? "Compact View" : "Expanded View"}
        </button>
        <span className="text-muted-foreground">|</span>
        <button className="text-[#0369a1] hover:underline font-medium">
          Group by Family
        </button>
      </div>

      {/* Include Options Card */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Include on Grade List */}
          <div>
            <h3 className="font-bold text-sm mb-3">Include on Grade List</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="teacher"
                  checked={includeTeacher}
                  onCheckedChange={(c) => setIncludeTeacher(c === true)}
                />
                <Label htmlFor="teacher" className="text-sm cursor-pointer">
                  Teacher
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="comments"
                  checked={includeComments}
                  onCheckedChange={(c) => setIncludeComments(c === true)}
                />
                <Label htmlFor="comments" className="text-sm cursor-pointer">
                  Comments
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="percents"
                  checked={includePercents}
                  onCheckedChange={(c) => setIncludePercents(c === true)}
                />
                <Label htmlFor="percents" className="text-sm cursor-pointer">
                  Percents
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="minmax"
                  checked={includeMinMaxGrades}
                  onCheckedChange={(c) => setIncludeMinMaxGrades(c === true)}
                />
                <Label htmlFor="minmax" className="text-sm cursor-pointer">
                  Min. and Max. Grades
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Attendance Row 1: Year-to-date */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ytd-absences"
                  checked={includeYtdAbsences}
                  onCheckedChange={(c) => setIncludeYtdAbsences(c === true)}
                />
                <Label
                  htmlFor="ytd-absences"
                  className="text-sm cursor-pointer"
                >
                  Year-to-date Daily Absences
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="other-ytd"
                  checked={includeOtherAttendanceYtd}
                  onCheckedChange={(c) =>
                    setIncludeOtherAttendanceYtd(c === true)
                  }
                />
                <Label htmlFor="other-ytd" className="text-sm cursor-pointer">
                  Other Attendance Year-to-date:
                </Label>
                <Select
                  value={otherAttendanceYtdType}
                  onValueChange={setOtherAttendanceYtdType}
                >
                  <SelectTrigger className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Tardy">Tardy</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attendance Row 2: Marking Period */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="mp-absences"
                  checked={includeMpAbsences}
                  onCheckedChange={(c) => setIncludeMpAbsences(c === true)}
                />
                <Label
                  htmlFor="mp-absences"
                  className="text-sm cursor-pointer"
                >
                  Daily Absences this marking period
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="other-mp"
                  checked={includeOtherAttendanceMp}
                  onCheckedChange={(c) =>
                    setIncludeOtherAttendanceMp(c === true)
                  }
                />
                <Label htmlFor="other-mp" className="text-sm cursor-pointer">
                  Other Attendance this marking period:
                </Label>
                <Select
                  value={otherAttendanceMpType}
                  onValueChange={setOtherAttendanceMpType}
                >
                  <SelectTrigger className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Tardy">Tardy</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attendance Row 3: Period-by-period */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="period-absences"
                checked={includePeriodAbsences}
                onCheckedChange={(c) => setIncludePeriodAbsences(c === true)}
              />
              <Label
                htmlFor="period-absences"
                className="text-sm cursor-pointer"
              >
                Period-by-period absences
              </Label>
            </div>
          </div>

          <Separator />

          {/* Marking Periods */}
          <div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
              {quarterPeriods.length > 0
                ? quarterPeriods.map((mp) => (
                    <div key={mp.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`mp-${mp.id}`}
                        checked={selectedMpIds.includes(mp.id)}
                        onCheckedChange={() => toggleMp(mp.id)}
                      />
                      <Label
                        htmlFor={`mp-${mp.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {mp.title}
                      </Label>
                    </div>
                  ))
                : markingPeriods.map((mp) => (
                    <div key={mp.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`mp-${mp.id}`}
                        checked={selectedMpIds.includes(mp.id)}
                        onCheckedChange={() => toggleMp(mp.id)}
                      />
                      <Label
                        htmlFor={`mp-${mp.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {mp.title}
                      </Label>
                    </div>
                  ))}
            </div>
            <p className="text-sm text-muted-foreground">Marking Periods</p>
          </div>
        </CardContent>
      </Card>

      {/* Student Selection Table */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-[#0369a1] font-medium">
                {students.length} student{students.length !== 1 ? "s" : ""} were
                found.
              </p>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grade Levels</SelectItem>
                {gradeLevels.map((gl) => (
                  <SelectItem key={gl.id} value={gl.id}>
                    {gl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedStudentIds.length === students.length &&
                          students.length > 0
                        }
                        onCheckedChange={toggleAllStudents}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0369a1]"
                      />
                    </TableHead>
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
                  {students.map((student, idx) => (
                    <TableRow
                      key={student.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {getStudentName(student)}
                      </TableCell>
                      <TableCell>{student.student_number}</TableCell>
                      <TableCell>{student.grade_level || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom CTA */}
      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={
            generating ||
            selectedStudentIds.length === 0 ||
            selectedMpIds.length === 0
          }
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-6 py-2.5"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ClipboardList className="h-4 w-4 mr-2" />
          )}
          Create Grade Lists for Selected Students
        </Button>
      </div>


    </div>
  );
}
