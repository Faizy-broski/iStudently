"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Loader2, GraduationCap, Users, Printer } from "lucide-react";
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

export default function TranscriptsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Options state ─────────────────────────────────────────────
  const [includeGrades, setIncludeGrades] = useState(true);
  const [includeStudentPhoto, setIncludeStudentPhoto] = useState(false);
  const [includeComments, setIncludeComments] = useState(false);
  const [includeCredits, setIncludeCredits] = useState(true);
  const [includeCreditHours, setIncludeCreditHours] = useState(false);
  const [lastRow, setLastRow] = useState<"na" | "gpa" | "total">("na");
  const [includeStudiesCertificate, setIncludeStudiesCertificate] =
    useState(false);

  // Marking period types
  const [mpQuarter, setMpQuarter] = useState(false);
  const [mpSemester, setMpSemester] = useState(false);
  const [mpYear, setMpYear] = useState(false);

  // Extra
  const [includeGraduationPaths, setIncludeGraduationPaths] = useState(false);

  // Students
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);


  // ── Load students ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [studentsRes, glRes] = await Promise.all([
        gradesApi.getStudentsForGrades({
          campus_id: selectedCampus?.id,
          grade_level: gradeFilter !== "all" ? gradeFilter : undefined,
          limit: 500,
        }),
        academicsApi.getGradeLevels(),
      ]);

      if (studentsRes.success && studentsRes.data) {
        setStudents(studentsRes.data);
        setSelectedStudentIds(studentsRes.data.map((s) => s.id));
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

    const mpTypes: string[] = [];
    if (mpQuarter) mpTypes.push("QTR");
    if (mpSemester) mpTypes.push("SEM");
    if (mpYear) mpTypes.push("FY");

    setGenerating(true);
    try {
      const res = await gradesApi.generateTranscripts({
        student_ids: selectedStudentIds,
        campus_id: selectedCampus?.id,
        options: {
          include_grades: includeGrades,
          include_student_photo: includeStudentPhoto,
          include_comments: includeComments,
          include_credits: includeCredits,
          include_credit_hours: includeCreditHours,
          last_row: lastRow,
          include_studies_certificate: includeStudiesCertificate,
          marking_period_types: mpTypes,
          include_graduation_paths: includeGraduationPaths,
        },
      });

      if (res.success) {
        const cards = res.data?.transcripts || res.data?.data?.transcripts || [];
        if (cards.length > 0) {
          printReportCards("Transcript", cards as ReportCardData[]);
        } else {
          toast.success(
            `Transcripts generated for ${selectedStudentIds.length} student(s)`
          );
        }
      } else {
        toast.error(res.error || "Failed to generate transcripts");
      }
    } catch {
      toast.error("Failed to generate transcripts");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-[#57A3CC]" />
            Transcripts
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure and generate transcripts for selected students
            {selectedCampus && (
              <span className="ml-1 font-medium">
                — {selectedCampus.name}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || selectedStudentIds.length === 0}
          className="bg-[#0369a1] hover:bg-[#0284c7] text-white"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Printer className="h-4 w-4 mr-2" />
          )}
          CREATE TRANSCRIPTS FOR SELECTED STUDENTS
        </Button>
      </div>

      {/* ── Include on Transcript ───────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Include on Transcript
          </h2>

          {/* Grades */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="grades"
              checked={includeGrades}
              onCheckedChange={(v) => setIncludeGrades(!!v)}
            />
            <Label htmlFor="grades" className="text-sm cursor-pointer font-medium">
              Grades
            </Label>
          </div>

          {/* Student Photo */}
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

          {/* Comments */}
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

          {/* Credits */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="credits"
              checked={includeCredits}
              onCheckedChange={(v) => setIncludeCredits(!!v)}
            />
            <Label htmlFor="credits" className="text-sm cursor-pointer font-medium">
              Credits
            </Label>
          </div>

          {/* Credit Hours */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="credit-hours"
              checked={includeCreditHours}
              onCheckedChange={(v) => setIncludeCreditHours(!!v)}
            />
            <Label htmlFor="credit-hours" className="text-sm cursor-pointer">
              Credit Hours
            </Label>
          </div>

          {/* Last row radio */}
          <div className="space-y-2">
            <RadioGroup
              value={lastRow}
              onValueChange={(v) => setLastRow(v as "na" | "gpa" | "total")}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="na" id="lr-na" />
                <Label htmlFor="lr-na" className="text-sm cursor-pointer">
                  N/A
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="gpa" id="lr-gpa" />
                <Label htmlFor="lr-gpa" className="text-sm cursor-pointer">
                  GPA
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="total" id="lr-total" />
                <Label htmlFor="lr-total" className="text-sm cursor-pointer">
                  Total
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Last row</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Studies Certificate ──────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="studies-certificate"
              checked={includeStudiesCertificate}
              onCheckedChange={(v) => setIncludeStudiesCertificate(!!v)}
            />
            <Label
              htmlFor="studies-certificate"
              className="text-sm cursor-pointer"
            >
              Studies Certificate
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* ── Marking Periods ─────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-quarter"
                checked={mpQuarter}
                onCheckedChange={(v) => setMpQuarter(!!v)}
              />
              <Label htmlFor="mp-quarter" className="text-sm cursor-pointer">
                Quarter
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-semester"
                checked={mpSemester}
                onCheckedChange={(v) => setMpSemester(!!v)}
              />
              <Label htmlFor="mp-semester" className="text-sm cursor-pointer">
                Semester
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="mp-year"
                checked={mpYear}
                onCheckedChange={(v) => setMpYear(!!v)}
              />
              <Label htmlFor="mp-year" className="text-sm cursor-pointer">
                Year
              </Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Marking Periods</p>
        </CardContent>
      </Card>

      {/* ── Graduation Paths ────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="graduation-paths"
              checked={includeGraduationPaths}
              onCheckedChange={(v) => setIncludeGraduationPaths(!!v)}
            />
            <Label
              htmlFor="graduation-paths"
              className="text-sm cursor-pointer"
            >
              Graduation Paths
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
            disabled={generating || selectedStudentIds.length === 0}
            size="lg"
            className="bg-[#0369a1] hover:bg-[#0284c7] text-white px-8"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            CREATE TRANSCRIPTS FOR SELECTED STUDENTS
          </Button>
        </div>
      )}


    </div>
  );
}
