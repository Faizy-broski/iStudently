"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { GradingScaleGrade } from "@/lib/api/grades";
import {
  TeacherCoursePeriodSelector,
  type TeacherCoursePeriodSelection,
} from "@/components/admin/teacher-programs/TeacherCoursePeriodSelector";

interface StudentFinalGradeRow {
  student_id: string;
  student_name: string;
  student_number: string;
  letter_grade: string;
  percent: string;
  comment: string;
}

export default function AdminInputFinalGradesPage() {
  const t = useTranslations("teacherPrograms.finalGrades");
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [selection, setSelection] = useState<TeacherCoursePeriodSelection>({
    teacherId: "",
    coursePeriod: null,
  });

  const [markingPeriods, setMarkingPeriods] = useState<
    { id: string; title: string; short_name: string }[]
  >([]);
  const [selectedMp, setSelectedMp] = useState<string>("");

  const [includeInactive, setIncludeInactive] = useState(false);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<StudentFinalGradeRow[]>([]);
  const [gradeScale, setGradeScale] = useState<GradingScaleGrade[]>([]);

  const selectedCp = selection.coursePeriod;

  useEffect(() => {
    gradesApi.getMarkingPeriods(selectedCampus?.id).then((res) => {
      if (res.success && res.data) {
        const mps = res.data;
        setMarkingPeriods(mps);
        if (mps.length > 0) setSelectedMp((prev) => prev || mps[0].id);
      }
    });
  }, [selectedCampus?.id]);

  useEffect(() => {
    if (!selectedCp) {
      setGradeScale([]);
      return;
    }
    const courseScaleId = selectedCp.course?.grading_scale_id;
    gradesApi.getGradingScales(selectedCampus?.id).then(async (res) => {
      if (!res.success || !res.data || res.data.length === 0) return;
      const scale =
        (courseScaleId && res.data.find((s) => s.id === courseScaleId)) ||
        res.data.find((s) => s.is_active) ||
        res.data[0];
      const gradesRes = await gradesApi.getGradingScaleGrades(scale.id);
      if (gradesRes.success && gradesRes.data) {
        setGradeScale(gradesRes.data.sort((a, b) => b.break_off - a.break_off));
      }
    });
  }, [selectedCp, selectedCampus?.id]);

  useEffect(() => {
    if (!selectedCp || !selectedMp) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    Promise.all([
      gradesApi.getStudentsForGrades({
        course_period_id: selectedCp.id,
        campus_id: selectedCampus?.id,
        limit: 100,
      }),
      gradesApi.getFinalGrades({ course_period_id: selectedCp.id, marking_period_id: selectedMp }),
    ])
      .then(([studentsRes, finalGradesRes]) => {
        if (!studentsRes.success || !studentsRes.data) return;
        const existingByStudent: Record<string, gradesApi.StudentFinalGrade> = {};
        for (const g of finalGradesRes.data ?? []) existingByStudent[g.student_id] = g;

        const rows: StudentFinalGradeRow[] = studentsRes.data.map((student) => {
          const existing = existingByStudent[student.id];
          return {
            student_id: student.id,
            student_number: student.student_number,
            student_name: student.profile
              ? `${student.profile.first_name} ${student.profile.last_name}`
              : "Unknown Student",
            letter_grade: existing?.letter_grade ?? "N/A",
            percent: existing?.percent_grade != null ? String(existing.percent_grade) : "",
            comment: existing?.comment ?? "",
          };
        });
        setStudents(rows);
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedCp, selectedMp, selectedCampus?.id, includeInactive]);

  const handleGradeChange = (
    studentId: string,
    field: "letter_grade" | "percent",
    value: string
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_id !== studentId) return s;
        let newPercent = s.percent;
        let newLetter = s.letter_grade;
        if (field === "letter_grade") {
          newLetter = value;
          const matchedG = gradeScale.find((g) => g.title === value);
          if (matchedG && !s.percent) newPercent = (matchedG.break_off ?? "").toString();
        } else {
          newPercent = value;
        }
        return { ...s, letter_grade: newLetter, percent: newPercent };
      })
    );
  };

  const handleSave = async () => {
    if (!selectedCp || !selectedMp || students.length === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all(
        students.map((s) =>
          gradesApi.saveFinalGrade({
            student_id: s.student_id,
            course_period_id: selectedCp.id,
            marking_period_id: selectedMp,
            percent_grade: s.percent !== "" ? parseFloat(s.percent) : null,
            letter_grade: s.letter_grade !== "N/A" ? s.letter_grade : null,
            comment: s.comment || null,
            is_override: true,
          })
        )
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        toast.error(t("savePartialFailure", { count: failed.length, total: students.length }));
      } else {
        toast.success(t("saveSuccess"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Award className="h-7 w-7 text-amber-500" />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <TeacherCoursePeriodSelector value={selection} onChange={setSelection} />

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">{t("markingPeriod")}</span>
              <Select value={selectedMp} onValueChange={setSelectedMp}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("markingPeriodPlaceholder")} />
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inactive"
                checked={includeInactive}
                onCheckedChange={(c) => setIncludeInactive(!!c)}
              />
              <label htmlFor="inactive" className="text-sm font-medium">
                {t("includeInactive")}
              </label>
            </div>
            <Button onClick={handleSave} disabled={saving || students.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedCp ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {t("selectPrompt")}
        </div>
      ) : loadingStudents ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-1/3">{t("studentColumn")}</TableHead>
                <TableHead className="w-1/4">{t("idColumn")}</TableHead>
                <TableHead>{t("gradeColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    {t("noStudents")}
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student, idx) => (
                  <TableRow key={student.student_id} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                    <TableCell className="font-medium">{student.student_name}</TableCell>
                    <TableCell className="text-muted-foreground">{student.student_number}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 w-[180px]">
                        <Select
                          value={student.letter_grade ?? "N/A"}
                          onValueChange={(val) => handleGradeChange(student.student_id, "letter_grade", val)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="N/A" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="N/A">N/A</SelectItem>
                            {gradeScale.map((g) => (
                              <SelectItem key={g.id} value={g.title}>
                                {g.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="w-[80px]"
                          value={student.percent ?? ""}
                          onChange={(e) => handleGradeChange(student.student_id, "percent", e.target.value)}
                          min="0"
                          max="100"
                          placeholder="%"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
