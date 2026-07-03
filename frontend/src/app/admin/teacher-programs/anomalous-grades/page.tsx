"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Loader2 } from "lucide-react";
import * as gradesApi from "@/lib/api/grades";
import {
  TeacherCoursePeriodSelector,
  type TeacherCoursePeriodSelection,
} from "@/components/admin/teacher-programs/TeacherCoursePeriodSelector";

interface AnomalousGradeRow {
  student_id: string;
  student_name: string;
  course_title: string;
  assignment_title: string;
  points_received: number;
  points_possible: number;
  anomaly_type: "Missing" | "Excused" | "Negative" | "Exceeds Max" | "Extra Credit";
}

export default function AdminAnomalousGradesPage() {
  const t = useTranslations("teacherPrograms.anomalousGrades");
  const [selection, setSelection] = useState<TeacherCoursePeriodSelection>({
    teacherId: "",
    coursePeriod: null,
  });

  const [includeAllCourses, setIncludeAllCourses] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [optMissing, setOptMissing] = useState(true);
  const [optExcusedNegative, setOptExcusedNegative] = useState(true);
  const [optExceedExtra, setOptExceedExtra] = useState(true);

  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [results, setResults] = useState<AnomalousGradeRow[]>([]);

  useEffect(() => {
    if (!selection.teacherId) {
      setResults([]);
      return;
    }
    setLoading(true);

    gradesApi
      .getAnomalousGradesAdvanced({
        staff_id: selection.teacherId,
        include_all_courses: includeAllCourses,
        include_inactive: includeInactive,
        missing: optMissing,
        negative: optExcusedNegative,
        exceed_max: optExceedExtra,
        extra_credit: optExceedExtra,
        advanced: true,
      })
      .then((res) => {
        setResults(res.success && res.data ? res.data : []);
        setLoading(false);
        setFirstLoad(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
        setFirstLoad(false);
      });
  }, [selection.teacherId, includeAllCourses, includeInactive, optMissing, optExcusedNegative, optExceedExtra]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Award className="h-8 w-8 text-[#51B4C9]" />
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <TeacherCoursePeriodSelector value={selection} onChange={setSelection} />

          <div className="flex flex-col border rounded-md bg-card shadow-sm text-sm">
            <div className="flex items-center justify-between border-b p-2 bg-muted/50">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="all-courses"
                  checked={includeAllCourses}
                  onCheckedChange={(c) => setIncludeAllCourses(!!c)}
                />
                <label htmlFor="all-courses" className="font-medium cursor-pointer">
                  {t("includeAllCourses")}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inactive"
                  checked={includeInactive}
                  onCheckedChange={(c) => setIncludeInactive(!!c)}
                />
                <label htmlFor="inactive" className="font-medium cursor-pointer">
                  {t("includeInactive")}
                </label>
              </div>
            </div>
            <div className="flex items-center gap-4 p-2 bg-muted/50">
              <span className="font-medium">{t("includeLabel")}</span>
              <div className="flex items-center gap-2 cursor-pointer">
                <Checkbox id="inc-missing" checked={optMissing} onCheckedChange={(c) => setOptMissing(!!c)} />
                <label htmlFor="inc-missing" className="cursor-pointer">{t("missingGrades")}</label>
              </div>
              <div className="flex items-center gap-2 cursor-pointer">
                <Checkbox id="inc-excused" checked={optExcusedNegative} onCheckedChange={(c) => setOptExcusedNegative(!!c)} />
                <label htmlFor="inc-excused" className="cursor-pointer">{t("excusedNegativeGrades")}</label>
              </div>
              <div className="flex items-center gap-2 cursor-pointer">
                <Checkbox id="inc-extra" checked={optExceedExtra} onCheckedChange={(c) => setOptExceedExtra(!!c)} />
                <label htmlFor="inc-extra" className="cursor-pointer">{t("exceedExtraGrades")}</label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selection.teacherId ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {t("selectPrompt")}
        </div>
      ) : loading && firstLoad ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <div className="font-medium text-sm p-2 text-foreground">
          {t("noResults")}
        </div>
      ) : (
        <div className="border rounded-md bg-card relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px]">{t("studentColumn")}</TableHead>
                <TableHead>{t("courseColumn")}</TableHead>
                <TableHead>{t("assignmentColumn")}</TableHead>
                <TableHead className="text-right">{t("pointsColumn")}</TableHead>
                <TableHead>{t("anomalyTypeColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row, idx) => (
                <TableRow key={`${row.student_id}-${idx}`} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                  <TableCell className="font-medium">{row.student_name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.course_title}</TableCell>
                  <TableCell className="text-muted-foreground">{row.assignment_title}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.points_received} / {row.points_possible}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium
                      ${row.anomaly_type === "Missing" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : ""}
                      ${row.anomaly_type === "Excused" || row.anomaly_type === "Negative" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" : ""}
                      ${row.anomaly_type === "Exceeds Max" || row.anomaly_type === "Extra Credit" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : ""}
                    `}
                    >
                      {row.anomaly_type}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
