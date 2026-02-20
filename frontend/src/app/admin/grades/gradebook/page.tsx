"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  BarChart3,
  Users,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type {
  GradebookBreakdownEntry,
  AssignmentOption,
  CoursePeriod,
} from "@/lib/api/grades";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Chart colors palette
const COLORS = [
  "#0369a1",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#22c55e",
  "#f97316",
  "#6366f1",
  "#06b6d4",
  "#d946ef",
  "#84cc16",
  "#e11d48",
  "#a855f7",
];

interface MarkingPeriodItem {
  id: string;
  title: string;
  short_name: string;
  mp_type: string;
}

export default function GradebookBreakdownPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Reference data ────────────────────────────────────────────
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);

  // ── Filters ───────────────────────────────────────────────────
  const [selectedCp, setSelectedCp] = useState<string>("");
  const [selectedMp, setSelectedMp] = useState<string>("");
  const [selectedAssignment, setSelectedAssignment] =
    useState<string>("totals");
  const [chartType, setChartType] = useState<"line" | "pie" | "list">("line");

  // ── Data ──────────────────────────────────────────────────────
  const [breakdown, setBreakdown] = useState<GradebookBreakdownEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // ── Load reference data ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      gradesApi.getCoursePeriods(selectedCampus?.id),
      gradesApi.getMarkingPeriods(selectedCampus?.id),
    ]).then(([cpRes, mpRes]) => {
      if (cpRes.success && cpRes.data) {
        setCoursePeriods(cpRes.data);
        if (cpRes.data.length > 0) setSelectedCp(cpRes.data[0].id);
      }
      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
        const defaultMp =
          mpRes.data.find((m) => m.mp_type === "QTR") || mpRes.data[0];
        if (defaultMp) setSelectedMp(defaultMp.id);
      }
      setLoading(false);
    });
  }, [user, selectedCampus?.id]);

  // ── Load assignments when course period changes ───────────────
  useEffect(() => {
    if (!selectedCp) return;
    gradesApi
      .getAssignmentOptions({
        course_period_id: selectedCp,
        marking_period_id: selectedMp || undefined,
        campus_id: selectedCampus?.id,
      })
      .then((res) => {
        if (res.success && res.data) {
          setAssignments(res.data);
        }
      });
  }, [selectedCp, selectedMp, selectedCampus?.id]);

  // ── Load breakdown data ───────────────────────────────────────
  const loadBreakdown = useCallback(async () => {
    if (!selectedCp) return;
    setBreakdownLoading(true);
    try {
      const res = await gradesApi.getGradebookBreakdown({
        course_period_id: selectedCp,
        assignment_id: selectedAssignment,
        marking_period_id: selectedMp || undefined,
        campus_id: selectedCampus?.id,
      });
      if (res.success && res.data) {
        setBreakdown(res.data);
      }
    } catch {
      toast.error("Failed to load gradebook breakdown");
    } finally {
      setBreakdownLoading(false);
    }
  }, [selectedCp, selectedAssignment, selectedMp, selectedCampus?.id]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  // ── Helpers ───────────────────────────────────────────────────
  const getCoursePeriodLabel = (cp: CoursePeriod) => {
    const course = cp.course?.title || "Course";
    const teacher = cp.teacher
      ? `${cp.teacher.first_name} ${cp.teacher.last_name}`
      : "";
    return teacher ? `${course} — ${teacher}` : course;
  };

  const totalStudents = breakdown.reduce(
    (sum, b) => sum + b.student_count,
    0
  );

  // Chart data for Recharts
  const lineData = breakdown.map((b) => ({
    name: b.gpa_value.toString(),
    students: b.student_count,
    grade: b.grade_title,
  }));

  const pieData = breakdown
    .filter((b) => b.student_count > 0)
    .map((b) => ({
      name: `${b.grade_title} (${b.gpa_value})`,
      value: b.student_count,
    }));

  const assignmentTitle =
    selectedAssignment === "totals"
      ? "Grade"
      : assignments.find((a) => a.id === selectedAssignment)?.title || "Grade";

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-[#57A3CC]" />
          Gradebook Breakdown
        </h1>
        <p className="text-muted-foreground mt-2">
          Grade distribution analysis by assignment or totals
          {selectedCampus && (
            <span className="ml-1 font-medium">
              — {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Course Period */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">
                Course Period
              </label>
              <Select value={selectedCp} onValueChange={setSelectedCp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course period" />
                </SelectTrigger>
                <SelectContent>
                  {coursePeriods.map((cp) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {getCoursePeriodLabel(cp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Marking Period */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Marking Period
              </label>
              <Select value={selectedMp} onValueChange={setSelectedMp}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
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

            {/* Assignment */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">
                Assignment
              </label>
              <Select
                value={selectedAssignment}
                onValueChange={setSelectedAssignment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Totals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totals">Totals</SelectItem>
                  {assignments
                    .filter((a) => a.type === "assignment_type")
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  {assignments.filter((a) => a.type === "assignment_type")
                    .length > 0 &&
                    assignments.filter((a) => a.type === "assignment").length >
                      0 && (
                      <SelectItem value="__divider" disabled>
                        ───────────────
                      </SelectItem>
                    )}
                  {assignments
                    .filter((a) => a.type === "assignment")
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={loadBreakdown}
              disabled={breakdownLoading || !selectedCp}
              className="bg-[#0369a1] hover:bg-[#025d8c] text-white"
            >
              Go
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart Area */}
      {breakdownLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : breakdown.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No students were found.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Tabs
              value={chartType}
              onValueChange={(v) => setChartType(v as "line" | "pie" | "list")}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="line" className="gap-1.5">
                  <LineChartIcon className="h-4 w-4" />
                  Line
                </TabsTrigger>
                <TabsTrigger value="pie" className="gap-1.5">
                  <PieChartIcon className="h-4 w-4" />
                  Pie
                </TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5">
                  <List className="h-4 w-4" />
                  List
                </TabsTrigger>
              </TabsList>

              <h3 className="text-lg font-semibold text-center mb-4">
                {assignmentTitle} Breakdown
              </h3>

              {/* ── Line Chart ─────────────────────────────── */}
              <TabsContent value="line">
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        label={{
                          value: "GPA Value",
                          position: "insideBottom",
                          offset: -5,
                        }}
                      />
                      <YAxis
                        allowDecimals={false}
                        label={{
                          value: "Students",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value: number, _name: string) => [
                          value,
                          "Students",
                        ]}
                        labelFormatter={(label: string) => {
                          const d = lineData.find((x) => x.name === label);
                          return d ? `${d.grade} (GPA ${label})` : label;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="students"
                        stroke="#0369a1"
                        strokeWidth={2}
                        dot={{
                          r: 5,
                          fill: "#0369a1",
                          strokeWidth: 0,
                        }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* ── Pie Chart ──────────────────────────────── */}
              <TabsContent value="pie">
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [value, "Students"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* ── List View ──────────────────────────────── */}
              <TabsContent value="list">
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                        <TableHead className="text-white font-semibold">
                          TITLE
                        </TableHead>
                        <TableHead className="text-white font-semibold text-center">
                          GPA VALUE
                        </TableHead>
                        <TableHead className="text-white font-semibold text-center">
                          NUMBER OF STUDENTS
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((entry, idx) => (
                        <TableRow
                          key={idx}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <TableCell className="font-medium">
                            {entry.grade_title}
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.gpa_value}
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.student_count}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="bg-gray-100 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-center">—</TableCell>
                        <TableCell className="text-center">
                          {totalStudents}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
