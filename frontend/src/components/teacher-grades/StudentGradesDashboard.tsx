"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Award, CloudDownload, Search, Loader2, ArrowLeft, ChevronRight } from "lucide-react";
import { useAcademic } from "@/context/AcademicContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { StudentCourseGradeSummary } from "@/lib/api/grades";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import type { CoursePeriodStudent } from "@/lib/api/courses";
import { getMarkingPeriods } from "@/lib/api/marking-periods";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncludeOptions {
  teacher: boolean;
  comments: boolean;
  percents: boolean;
  minmax: boolean;
  ytd_absences: boolean;
  mp_absences: boolean;
  period_absences: boolean;
}

interface GradeRow {
  student_id: string;
  student_name: string;
  student_number: string;
  grade_level: string;
  course_title: string;
  teacher_name: string;
  grades: Record<string, { letter?: string; percent?: number }>; // keyed by mp_id
}

// ─── Phase 1: Student Selection Form ──────────────────────────────────────────

function SelectionPhase({
  onGenerate,
}: {
  onGenerate: (studentIds: string[], mpIds: string[], options: IncludeOptions) => void;
}) {
  const { selectedAcademicYear } = useAcademic();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const [search, setSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [quarters, setQuarters] = useState<{ id: string; title: string; short_name: string }[]>([]);
  const [selectedMps, setSelectedMps] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<IncludeOptions>({
    teacher: true,
    comments: true,
    percents: false,
    minmax: false,
    ytd_absences: true,
    mp_absences: true,
    period_absences: false,
  });

  const { students, loading: loadingStudents } = useTeacherStudents({ search, limit: 500 });

  // Load quarters
  useEffect(() => {
    if (!campusId && !selectedAcademicYear) return;
    getMarkingPeriods(campusId).then((all) => {
      const qtrs = all
        .filter((mp) => mp.mp_type === "QTR")
        .sort((a, b) => a.sort_order - b.sort_order);
      setQuarters(qtrs);
    }).catch(() => {});
  }, [campusId, selectedAcademicYear]);

  const allSelected = students.length > 0 && selectedStudents.size === students.length;

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s: CoursePeriodStudent) => s.id)));
    }
  };

  const toggleMp = (id: string) => {
    setSelectedMps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const setOpt = (key: keyof IncludeOptions) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = () => {
    if (selectedStudents.size === 0 || selectedMps.size === 0) return;
    onGenerate(Array.from(selectedStudents), Array.from(selectedMps), options);
  };

  const CreateBtn = (
    <Button
      onClick={handleGenerate}
      disabled={selectedStudents.size === 0 || selectedMps.size === 0}
      className="bg-[#5B8DB8] hover:bg-[#4a7aa6] text-white font-semibold uppercase text-xs tracking-wide px-4 py-2 rounded-sm"
    >
      Create Grade Lists for Selected Students
    </Button>
  );

  return (
    <div className="space-y-0 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-800">Final Grades</h1>
        </div>
        {CreateBtn}
      </div>

      {/* Expand / Group links */}
      <div className="text-[#4A90E2] text-sm mb-3">
        <button className="hover:underline">Expanded View</button>
        <span className="mx-2 text-gray-400">|</span>
        <button className="hover:underline">Group by Family</button>
      </div>

      {/* Include on Grade List */}
      <div className="border border-gray-300 bg-white p-4 mb-0">
        <p className="font-semibold text-gray-700 mb-3">Include on Grade List</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {/* Left col */}
          <div className="space-y-2">
            {[
              { key: "teacher" as const, label: "Teacher" },
              { key: "percents" as const, label: "Percents" },
              { key: "ytd_absences" as const, label: "Year-to-date Daily Absences" },
              { key: "mp_absences" as const, label: "Daily Absences this marking period" },
              { key: "period_absences" as const, label: "Period-by-period absences" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`opt-${key}`}
                  checked={options[key]}
                  onCheckedChange={() => setOpt(key)}
                  className="rounded-none h-4 w-4"
                />
                <label htmlFor={`opt-${key}`} className="cursor-pointer text-gray-700">{label}</label>
              </div>
            ))}
          </div>
          {/* Right col */}
          <div className="space-y-2">
            {[
              { key: "comments" as const, label: "Comments" },
              { key: "minmax" as const, label: "Min. and Max. Grades" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`opt-${key}`}
                  checked={options[key]}
                  onCheckedChange={() => setOpt(key)}
                  className="rounded-none h-4 w-4"
                />
                <label htmlFor={`opt-${key}`} className="cursor-pointer text-gray-700">{label}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-300 bg-white px-4 py-3">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-1">
          {quarters.map((q) => (
            <div key={q.id} className="flex items-center gap-2">
              <Checkbox
                id={`mp-${q.id}`}
                checked={selectedMps.has(q.id)}
                onCheckedChange={() => toggleMp(q.id)}
                className="rounded-none h-4 w-4"
              />
              <label htmlFor={`mp-${q.id}`} className="cursor-pointer text-gray-700">{q.title}</label>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">Marking Periods</p>
      </div>

      {/* Student list */}
      <div className="border-t border-gray-300 bg-gray-100 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {loadingStudents ? "Loading..." : `${students.length} student${students.length !== 1 ? "s" : ""} were found.`}
            <CloudDownload className="inline h-5 w-5 ml-2 text-black bg-white rounded cursor-pointer drop-shadow-sm" />
          </span>
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-40 h-7 rounded-none border-gray-400 text-xs pr-7 bg-white"
            />
            <Search className="h-3.5 w-3.5 absolute right-2 top-1.5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <td className="p-2 w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  className="rounded-none h-4 w-4"
                />
              </td>
              <td className="p-2 w-8" />
              <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Student</td>
              <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Studently ID</td>
              <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs tracking-wide">Grade Level</td>
            </tr>
          </thead>
          <tbody>
            {loadingStudents ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No students found.</td>
              </tr>
            ) : (
              students.map((student: CoursePeriodStudent, i: number) => {
                const isChecked = selectedStudents.has(student.id);
                const name = student.profile
                  ? `${student.profile.first_name ?? ""} ${student.profile.last_name ?? ""}`.trim() || "—"
                  : "—";
                const gradeLevel = student.grade_level ?? "—";
                return (
                  <tr
                    key={student.id}
                    className={`border-b border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors ${isChecked ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                    onClick={() => toggleStudent(student.id)}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleStudent(student.id)}
                        className="rounded-none h-4 w-4"
                      />
                    </td>
                    <td className="p-2 text-[#4A90E2]">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </td>
                    <td className="p-2 text-gray-800">{name}</td>
                    <td className="p-2 text-gray-600">{student.student_number ?? i + 1}</td>
                    <td className="p-2 text-gray-600">{gradeLevel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom create button */}
      <div className="flex justify-center pt-4">
        {CreateBtn}
      </div>
    </div>
  );
}

// ─── Phase 2: Grade List View ──────────────────────────────────────────────────

function GradeListPhase({
  studentIds,
  mpIds,
  options,
  onBack,
}: {
  studentIds: string[];
  mpIds: string[];
  options: IncludeOptions;
  onBack: () => void;
}) {
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [mpTitles, setMpTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load MP titles
        const allMps = await getMarkingPeriods(campusId).catch(() => []);
        const titles: Record<string, string> = {};
        allMps.forEach((mp) => { titles[mp.id] = mp.title; });
        setMpTitles(titles);

        // For each student × MP, fetch grade summary
        const allRows: GradeRow[] = [];
        await Promise.all(
          studentIds.map(async (studentId) => {
            // Fetch summary for each selected MP
            const gradesByMp: Record<string, StudentCourseGradeSummary[]> = {};
            await Promise.all(
              mpIds.map(async (mpId) => {
                const res = await gradesApi.getStudentGradesSummaryAPI(studentId, mpId, campusId).catch(() => ({ success: false, data: [] }));
                gradesByMp[mpId] = (res.success && res.data) ? res.data : [];
              })
            );

            // Collect all unique course periods across all MPs
            const cpMap = new Map<string, { course_title: string; teacher_name: string }>();
            for (const grades of Object.values(gradesByMp)) {
              for (const g of grades) {
                if (!cpMap.has(g.course_period_id)) {
                  cpMap.set(g.course_period_id, {
                    course_title: g.course_title,
                    teacher_name: g.teacher_name ?? "",
                  });
                }
              }
            }

            cpMap.forEach((info, cpId) => {
              const gradesPerMp: Record<string, { letter?: string; percent?: number }> = {};
              for (const [mpId, grades] of Object.entries(gradesByMp)) {
                const match = grades.find((g) => g.course_period_id === cpId);
                if (match) gradesPerMp[mpId] = { letter: match.letter, percent: match.percent };
              }
              allRows.push({
                student_id: studentId,
                student_name: "", // filled below
                student_number: "",
                grade_level: "",
                course_title: info.course_title,
                teacher_name: info.teacher_name,
                grades: gradesPerMp,
              });
            });
          })
        );

        setRows(allRows);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentIds, mpIds, campusId]);

  const mpList = mpIds.map((id) => ({ id, title: mpTitles[id] || id }));

  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-[#4A90E2] hover:underline text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Award className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-gray-800">Final Grades</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No grades were found for the selected students and marking periods.
        </div>
      ) : (
        <div className="bg-white border border-gray-300 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs">Student</td>
                <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs">Course</td>
                {options.teacher && (
                  <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs">Teacher</td>
                )}
                {mpList.map((mp) => (
                  <td key={mp.id} className="p-2 text-[#4A90E2] font-semibold uppercase text-xs text-center">
                    {mp.title}
                  </td>
                ))}
                {options.percents && mpList.map((mp) => (
                  <td key={`pct-${mp.id}`} className="p-2 text-[#4A90E2] font-semibold uppercase text-xs text-center">
                    {mp.title} %
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.student_id}-${row.course_title}-${i}`} className={`border-b border-gray-200 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="p-2 text-[#4A90E2] font-medium">{row.student_name || `Student #${row.student_id.slice(-4)}`}</td>
                  <td className="p-2 text-gray-700">{row.course_title}</td>
                  {options.teacher && <td className="p-2 text-gray-600">{row.teacher_name || "—"}</td>}
                  {mpList.map((mp) => (
                    <td key={mp.id} className="p-2 text-center font-bold text-gray-800">
                      {row.grades[mp.id]?.letter || "—"}
                    </td>
                  ))}
                  {options.percents && mpList.map((mp) => (
                    <td key={`pct-${mp.id}`} className="p-2 text-center text-gray-600">
                      {row.grades[mp.id]?.percent != null ? `${row.grades[mp.id]!.percent}%` : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────

export function StudentGradesDashboard() {
  const [phase, setPhase] = useState<"select" | "view">("select");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedMps, setSelectedMps] = useState<string[]>([]);
  const [options, setOptions] = useState<IncludeOptions>({
    teacher: true, comments: true, percents: false, minmax: false,
    ytd_absences: true, mp_absences: true, period_absences: false,
  });

  const handleGenerate = (sIds: string[], mpIds: string[], opts: IncludeOptions) => {
    setSelectedStudents(sIds);
    setSelectedMps(mpIds);
    setOptions(opts);
    setPhase("view");
  };

  if (phase === "view") {
    return (
      <GradeListPhase
        studentIds={selectedStudents}
        mpIds={selectedMps}
        options={options}
        onBack={() => setPhase("select")}
      />
    );
  }

  return <SelectionPhase onGenerate={handleGenerate} />;
}
