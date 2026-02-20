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
import { Loader2, FileText, Users, Printer } from "lucide-react";
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

export default function ReportCardsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Options state ─────────────────────────────────────────────
  const [includeStudentPhoto, setIncludeStudentPhoto] = useState(false);
  const [includeTeacher, setIncludeTeacher] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includePercents, setIncludePercents] = useState(false);
  const [includeMinMaxGrades, setIncludeMinMaxGrades] = useState(false);
  const [includeCredits, setIncludeCredits] = useState(false);
  const [includeClassAverage, setIncludeClassAverage] = useState(false);
  const [includeClassRank, setIncludeClassRank] = useState(false);
  const [includeGroupBySubject, setIncludeGroupBySubject] = useState(false);

  // Attendance options
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

  // Last row
  const [lastRowTotal, setLastRowTotal] = useState(false);
  const [lastRowGpa, setLastRowGpa] = useState(false);
  const [lastRowClassAverage, setLastRowClassAverage] = useState(false);
  const [lastRowClassRank, setLastRowClassRank] = useState(false);

  // Extra
  const [includeFreeText, setIncludeFreeText] = useState(false);
  const [includeMailingLabels, setIncludeMailingLabels] = useState(false);

  // Marking periods
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [selectedMpIds, setSelectedMpIds] = useState<string[]>([]);

  // Students
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);


  // ── Load students & marking periods ────────────────────────────
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
      const res = await gradesApi.generateReportCards({
        student_ids: selectedStudentIds,
        campus_id: selectedCampus?.id,
        options: {
          include_student_photo: includeStudentPhoto,
          include_teacher: includeTeacher,
          include_comments: includeComments,
          include_percents: includePercents,
          include_min_max_grades: includeMinMaxGrades,
          include_credits: includeCredits,
          include_class_average: includeClassAverage,
          include_class_rank: includeClassRank,
          include_group_by_subject: includeGroupBySubject,
          include_ytd_absences: includeYtdAbsences,
          include_other_attendance_ytd: includeOtherAttendanceYtd,
          other_attendance_ytd_type: otherAttendanceYtdType,
          include_mp_absences: includeMpAbsences,
          include_other_attendance_mp: includeOtherAttendanceMp,
          other_attendance_mp_type: otherAttendanceMpType,
          include_period_absences: includePeriodAbsences,
          last_row_total: lastRowTotal,
          last_row_gpa: lastRowGpa,
          last_row_class_average: lastRowClassAverage,
          last_row_class_rank: lastRowClassRank,
          include_free_text: includeFreeText,
          marking_period_ids: selectedMpIds,
          include_mailing_labels: includeMailingLabels,
        },
      });

      if (res.success) {
        const cards = res.data?.report_cards || res.data?.data?.report_cards || [];
        if (cards.length > 0) {
          printReportCards("Report Card", cards as ReportCardData[]);
        } else {
          toast.success(
            `Report cards generated for ${selectedStudentIds.length} student(s)`
          );
        }
      } else {
        toast.error(res.error || "Failed to generate report cards");
      }
    } catch {
      toast.error("Failed to generate report cards");
    } finally {
      setGenerating(false);
    }
  };

  // ── Group marking periods by type ─────────────────────────────
  const mpByType = markingPeriods.reduce(
    (acc, mp) => {
      const type = mp.mp_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(mp);
      return acc;
    },
    {} as Record<string, MarkingPeriodItem[]>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <FileText className="h-8 w-8 text-[#57A3CC]" />
            Report Cards
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure and generate report cards for selected students
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
          className="bg-[#0369a1] hover:bg-[#0284c7] text-white"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Printer className="h-4 w-4 mr-2" />
          )}
          CREATE REPORT CARDS FOR SELECTED STUDENTS
        </Button>
      </div>

      {/* ── Include on Report Card ──────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Include on Report Card
          </h2>

          {/* Row 1: Student Photo */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="student-photo"
              checked={includeStudentPhoto}
              onCheckedChange={(v) => setIncludeStudentPhoto(!!v)}
            />
            <Label htmlFor="student-photo" className="text-sm cursor-pointer">
              Student Photo
            </Label>
          </div>

          {/* Row 2: Teacher / Comments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="teacher"
                checked={includeTeacher}
                onCheckedChange={(v) => setIncludeTeacher(!!v)}
              />
              <Label htmlFor="teacher" className="text-sm cursor-pointer">
                Teacher
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="comments"
                checked={includeComments}
                onCheckedChange={(v) => setIncludeComments(!!v)}
              />
              <Label htmlFor="comments" className="text-sm cursor-pointer">
                Comments
              </Label>
            </div>
          </div>

          {/* Row 3: Percents / Min. and Max. Grades */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="percents"
                checked={includePercents}
                onCheckedChange={(v) => setIncludePercents(!!v)}
              />
              <Label htmlFor="percents" className="text-sm cursor-pointer">
                Percents
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="min-max"
                checked={includeMinMaxGrades}
                onCheckedChange={(v) => setIncludeMinMaxGrades(!!v)}
              />
              <Label htmlFor="min-max" className="text-sm cursor-pointer">
                Min. and Max. Grades
              </Label>
            </div>
          </div>

          {/* Row 4: Credits / Class average */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="credits"
                checked={includeCredits}
                onCheckedChange={(v) => setIncludeCredits(!!v)}
              />
              <Label htmlFor="credits" className="text-sm cursor-pointer">
                Credits
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="class-average"
                checked={includeClassAverage}
                onCheckedChange={(v) => setIncludeClassAverage(!!v)}
              />
              <Label
                htmlFor="class-average"
                className="text-sm cursor-pointer"
              >
                Class average
              </Label>
            </div>
          </div>

          {/* Row 5: Class Rank / Group courses by subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="class-rank"
                checked={includeClassRank}
                onCheckedChange={(v) => setIncludeClassRank(!!v)}
              />
              <Label htmlFor="class-rank" className="text-sm cursor-pointer">
                Class Rank
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="group-subject"
                checked={includeGroupBySubject}
                onCheckedChange={(v) => setIncludeGroupBySubject(!!v)}
              />
              <Label
                htmlFor="group-subject"
                className="text-sm cursor-pointer"
              >
                Group courses by subject
              </Label>
            </div>
          </div>

          {/* Attendance row 1: YTD absences / Other Attendance YTD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ytd-absences"
                checked={includeYtdAbsences}
                onCheckedChange={(v) => setIncludeYtdAbsences(!!v)}
              />
              <Label htmlFor="ytd-absences" className="text-sm cursor-pointer">
                Year-to-date Daily Absences
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="other-ytd"
                checked={includeOtherAttendanceYtd}
                onCheckedChange={(v) => setIncludeOtherAttendanceYtd(!!v)}
              />
              <Label htmlFor="other-ytd" className="text-sm cursor-pointer">
                Other Attendance Year-to-date:
              </Label>
              <Select
                value={otherAttendanceYtdType}
                onValueChange={setOtherAttendanceYtdType}
              >
                <SelectTrigger className="w-[130px] h-8">
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

          {/* Attendance row 2: MP absences / Other Attendance MP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-absences"
                checked={includeMpAbsences}
                onCheckedChange={(v) => setIncludeMpAbsences(!!v)}
              />
              <Label htmlFor="mp-absences" className="text-sm cursor-pointer">
                Daily Absences this marking period
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="other-mp"
                checked={includeOtherAttendanceMp}
                onCheckedChange={(v) => setIncludeOtherAttendanceMp(!!v)}
              />
              <Label htmlFor="other-mp" className="text-sm cursor-pointer">
                Other Attendance this marking period:
              </Label>
              <Select
                value={otherAttendanceMpType}
                onValueChange={setOtherAttendanceMpType}
              >
                <SelectTrigger className="w-[130px] h-8">
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

          {/* Period-by-period absences */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="period-absences"
              checked={includePeriodAbsences}
              onCheckedChange={(v) => setIncludePeriodAbsences(!!v)}
            />
            <Label
              htmlFor="period-absences"
              className="text-sm cursor-pointer"
            >
              Period-by-period absences
            </Label>
          </div>

          {/* Last row options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lr-total"
                  checked={lastRowTotal}
                  onCheckedChange={(v) => setLastRowTotal(!!v)}
                />
                <Label htmlFor="lr-total" className="text-sm cursor-pointer">
                  Total
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lr-gpa"
                  checked={lastRowGpa}
                  onCheckedChange={(v) => setLastRowGpa(!!v)}
                />
                <Label htmlFor="lr-gpa" className="text-sm cursor-pointer">
                  GPA
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lr-class-avg"
                  checked={lastRowClassAverage}
                  onCheckedChange={(v) => setLastRowClassAverage(!!v)}
                />
                <Label
                  htmlFor="lr-class-avg"
                  className="text-sm cursor-pointer"
                >
                  Class average
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lr-class-rank"
                  checked={lastRowClassRank}
                  onCheckedChange={(v) => setLastRowClassRank(!!v)}
                />
                <Label
                  htmlFor="lr-class-rank"
                  className="text-sm cursor-pointer"
                >
                  Class Rank
                </Label>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Last row</p>

          <Separator />

          {/* Free Text */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="free-text"
              checked={includeFreeText}
              onCheckedChange={(v) => setIncludeFreeText(!!v)}
            />
            <Label htmlFor="free-text" className="text-sm cursor-pointer">
              Free Text
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── Marking Periods ─────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Object.keys(mpByType).length > 0 ? (
            <>
              {Object.entries(mpByType).map(([type, periods]) => (
                <div key={type} className="space-y-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {periods.map((mp) => (
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
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Marking Periods</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No marking periods configured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Mailing Labels ──────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="mailing-labels"
              checked={includeMailingLabels}
              onCheckedChange={(v) => setIncludeMailingLabels(!!v)}
            />
            <Label
              htmlFor="mailing-labels"
              className="text-sm cursor-pointer font-medium"
            >
              Mailing Labels
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── Student Selector ────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Grade filter */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Filter by Grade:</Label>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {gradeLevels.map((gl) => (
                  <SelectItem key={gl.id} value={gl.name}>
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
            <>
              <p className="text-sm text-[#0369a1] font-medium">
                {students.length} student{students.length !== 1 ? "s" : ""} were
                found.
              </p>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                      <TableHead className="w-[50px] text-white">
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
                    {students.map((s, idx) => (
                      <TableRow
                        key={s.id}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedStudentIds.includes(s.id)}
                            onCheckedChange={() => toggleStudent(s.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
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

      {/* ── Bottom action ───────────────────────────────────── */}
      {students.length > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={handleGenerate}
            disabled={
              generating ||
              selectedStudentIds.length === 0 ||
              selectedMpIds.length === 0
            }
            size="lg"
            className="bg-[#0369a1] hover:bg-[#0284c7] text-white px-8"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            CREATE REPORT CARDS FOR SELECTED STUDENTS
          </Button>
        </div>
      )}


    </div>
  );
}
