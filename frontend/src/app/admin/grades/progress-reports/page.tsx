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
import { Loader2, ClipboardList, Users, Printer } from "lucide-react";
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

export default function ProgressReportsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Options state (matching RosarioSIS screenshot) ─────────────
  const [includeAssignedDate, setIncludeAssignedDate] = useState(false);
  const [includeDueDate, setIncludeDueDate] = useState(true);
  const [excludeUngradedEc, setExcludeUngradedEc] = useState(true);
  const [excludeUngradedNotDue, setExcludeUngradedNotDue] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [includeMailingLabels, setIncludeMailingLabels] = useState(false);

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

    setGenerating(true);
    try {
      const res = await gradesApi.generateProgressReports({
        student_ids: selectedStudentIds,
        campus_id: selectedCampus?.id,
        options: {
          include_assigned_date: includeAssignedDate,
          include_due_date: includeDueDate,
          exclude_ungraded_ec: excludeUngradedEc,
          exclude_ungraded_not_due: excludeUngradedNotDue,
          group_by_category: groupByCategory,
          include_mailing_labels: includeMailingLabels,
        },
      });

      if (res.success) {
        const cards = res.data?.progress_reports || res.data?.data?.progress_reports || [];
        if (cards.length > 0) {
          printReportCards("Progress Report", cards as ReportCardData[]);
        } else {
          toast.success(
            `Progress reports generated for ${selectedStudentIds.length} student(s)`
          );
        }
      } else {
        toast.error(res.error || "Failed to generate progress reports");
      }
    } catch {
      toast.error("Failed to generate progress reports");
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
            <ClipboardList className="h-8 w-8 text-[#57A3CC]" />
            Gradebook — Progress Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate progress reports for selected students
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
          CREATE PROGRESS REPORTS FOR SELECTED STUDENTS
        </Button>
      </div>

      {/* ── Options ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Row 1: Assigned Date / Exclude Ungraded E/C */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2 justify-end md:justify-start">
              <Label
                htmlFor="assigned-date"
                className="text-sm cursor-pointer"
              >
                Assigned Date
              </Label>
              <Checkbox
                id="assigned-date"
                checked={includeAssignedDate}
                onCheckedChange={(v) => setIncludeAssignedDate(!!v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="exclude-ec" className="text-sm cursor-pointer">
                Exclude Ungraded E/C Assignments
              </Label>
              <Checkbox
                id="exclude-ec"
                checked={excludeUngradedEc}
                onCheckedChange={(v) => setExcludeUngradedEc(!!v)}
              />
            </div>
          </div>

          {/* Row 2: Due Date / Exclude Ungraded Not Due */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2 justify-end md:justify-start">
              <Label htmlFor="due-date" className="text-sm cursor-pointer">
                Due Date
              </Label>
              <Checkbox
                id="due-date"
                checked={includeDueDate}
                onCheckedChange={(v) => setIncludeDueDate(!!v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="exclude-not-due"
                className="text-sm cursor-pointer"
              >
                Exclude Ungraded Assignments Not Due
              </Label>
              <Checkbox
                id="exclude-not-due"
                checked={excludeUngradedNotDue}
                onCheckedChange={(v) => setExcludeUngradedNotDue(!!v)}
              />
            </div>
          </div>

          {/* Row 3: Group by Category */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor="group-category"
              className="text-sm cursor-pointer"
            >
              Group by Assignment Category
            </Label>
            <Checkbox
              id="group-category"
              checked={groupByCategory}
              onCheckedChange={(v) => setGroupByCategory(!!v)}
            />
          </div>

          {/* Row 4: Mailing Labels */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor="mailing-labels"
              className="text-sm cursor-pointer"
            >
              Mailing Labels
            </Label>
            <Checkbox
              id="mailing-labels"
              checked={includeMailingLabels}
              onCheckedChange={(v) => setIncludeMailingLabels(!!v)}
            />
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
                {students.length} student
                {students.length !== 1 ? "s" : ""} were found.
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
            CREATE PROGRESS REPORTS FOR SELECTED STUDENTS
          </Button>
        </div>
      )}


    </div>
  );
}
