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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  TrendingUp,
  Users,
  Search,
  Medal,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import * as gradesApi from "@/lib/api/grades";
import * as academicsApi from "@/lib/api/academics";
import type { GradeLevel } from "@/lib/api/academics";
import type { GPARankEntry } from "@/lib/api/grades";

interface MarkingPeriodItem {
  id: string;
  title: string;
  short_name: string;
  mp_type: string;
}

type SortField = "class_rank" | "weighted_gpa" | "unweighted_gpa" | "student_name";
type SortDir = "asc" | "desc";

export default function GPAClassRanksPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Filters ───────────────────────────────────────────────────
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [selectedMp, setSelectedMp] = useState<string>("");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  // ── Sorting ───────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("class_rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Data ──────────────────────────────────────────────────────
  const [students, setStudents] = useState<GPARankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load reference data ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      gradesApi.getMarkingPeriods(selectedCampus?.id),
      academicsApi.getGradeLevels(),
    ]).then(([mpRes, glRes]) => {
      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
        const defaultMp =
          mpRes.data.find((m) => m.mp_type === "PRO") ||
          mpRes.data.find((m) => m.mp_type === "QTR") ||
          mpRes.data[0];
        if (defaultMp) setSelectedMp(defaultMp.id);
      }
      if (glRes.success && glRes.data) {
        setGradeLevels(glRes.data);
      }
    });
  }, [user, selectedCampus?.id]);

  // ── Load rank data ────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user || !selectedMp) return;
    setLoading(true);
    try {
      const res = await gradesApi.getGPARankList({
        marking_period_id: selectedMp,
        grade_level_id: gradeFilter !== "all" ? gradeFilter : undefined,
        campus_id: selectedCampus?.id,
        search: debouncedSearch || undefined,
      });
      if (res.success && res.data) {
        setStudents(res.data);
      }
    } catch {
      toast.error("Failed to load GPA / Class Rank data");
    } finally {
      setLoading(false);
    }
  }, [user, selectedMp, gradeFilter, selectedCampus?.id, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Sorting logic ─────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "class_rank" ? "asc" : "desc");
    }
  };

  const sortedStudents = [...students].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "class_rank":
        cmp = (a.class_rank ?? 9999) - (b.class_rank ?? 9999);
        break;
      case "weighted_gpa":
        cmp = a.weighted_gpa - b.weighted_gpa;
        break;
      case "unweighted_gpa":
        cmp = a.unweighted_gpa - b.unweighted_gpa;
        break;
      case "student_name":
        cmp = a.student_name.localeCompare(b.student_name);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className={`inline h-3.5 w-3.5 ml-1 cursor-pointer ${
        sortField === field ? "text-white opacity-100" : "text-white/50"
      }`}
    />
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-[#57A3CC]" />
          GPA / Class Rank List
        </h1>
        <p className="text-muted-foreground mt-2">
          View student GPA and class rank for each marking period
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
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Marking Period
              </Label>
              <Select value={selectedMp} onValueChange={setSelectedMp}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {markingPeriods
                    .filter(
                      (mp) =>
                        mp.mp_type === "PRO" ||
                        mp.mp_type === "QTR" ||
                        mp.mp_type === "SEM" ||
                        mp.mp_type === "FY"
                    )
                    .map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Grade Level
              </Label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {gradeLevels.map((gl) => (
                    <SelectItem key={gl.id} value={gl.id}>
                      {gl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <div className="relative w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-[#0369a1] font-medium">
            {sortedStudents.length} student
            {sortedStudents.length !== 1 ? "s" : ""} found.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No students found</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                    <TableHead
                      className="text-white font-semibold cursor-pointer select-none"
                      onClick={() => handleSort("student_name")}
                    >
                      STUDENT <SortIcon field="student_name" />
                    </TableHead>
                    <TableHead className="text-white font-semibold">
                      GRADE LEVEL
                    </TableHead>
                    <TableHead
                      className="text-white font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort("unweighted_gpa")}
                    >
                      UNWEIGHTED GPA <SortIcon field="unweighted_gpa" />
                    </TableHead>
                    <TableHead
                      className="text-white font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort("weighted_gpa")}
                    >
                      WEIGHTED GPA <SortIcon field="weighted_gpa" />
                    </TableHead>
                    <TableHead
                      className="text-white font-semibold text-center cursor-pointer select-none"
                      onClick={() => handleSort("class_rank")}
                    >
                      CLASS RANK <SortIcon field="class_rank" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((student, idx) => (
                    <TableRow
                      key={student.student_id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <TableCell className="font-medium">
                        {student.student_name}
                      </TableCell>
                      <TableCell>{student.grade_level || "—"}</TableCell>
                      <TableCell className="text-center font-mono">
                        {student.unweighted_gpa.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {student.weighted_gpa.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {student.class_rank != null ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {student.class_rank <= 3 && (
                              <Medal
                                className={`h-4 w-4 ${
                                  student.class_rank === 1
                                    ? "text-amber-500"
                                    : student.class_rank === 2
                                    ? "text-gray-400"
                                    : "text-amber-700"
                                }`}
                              />
                            )}
                            <Badge
                              variant={
                                student.class_rank <= 10
                                  ? "default"
                                  : "secondary"
                              }
                              className={
                                student.class_rank <= 3
                                  ? "bg-[#0369a1] hover:bg-[#025d8c]"
                                  : ""
                              }
                            >
                              {student.class_rank}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
