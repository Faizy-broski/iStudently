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
import {
  Loader2,
  CheckSquare,
  Users,
  Search,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import * as gradesApi from "@/lib/api/grades";
import type {
  TeacherCompletionEntry,
  SchoolPeriod,
} from "@/lib/api/grades";

interface MarkingPeriodItem {
  id: string;
  title: string;
  short_name: string;
  mp_type: string;
}

export default function TeacherCompletionPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // Filters
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodItem[]>([]);
  const [selectedMp, setSelectedMp] = useState<string>("");
  const [schoolPeriods, setSchoolPeriods] = useState<SchoolPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 400);

  // Data
  const [teachers, setTeachers] = useState<TeacherCompletionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Load reference data ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      gradesApi.getMarkingPeriods(selectedCampus?.id),
      gradesApi.getSchoolPeriods(selectedCampus?.id),
    ]).then(([mpRes, spRes]) => {
      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
        // Auto-select first QTR period
        const defaultMp =
          mpRes.data.find((m) => m.mp_type === "QTR") || mpRes.data[0];
        if (defaultMp) setSelectedMp(defaultMp.id);
      }
      if (spRes.success && spRes.data) {
        setSchoolPeriods(spRes.data);
      }
    });
  }, [user, selectedCampus?.id]);

  // ── Load teacher completion data ───────────────────────────────
  const loadTeachers = useCallback(async () => {
    if (!user || !selectedMp) return;
    setLoading(true);
    try {
      const res = await gradesApi.getTeacherCompletion({
        marking_period_id: selectedMp,
        school_period_id:
          selectedPeriod !== "all" ? selectedPeriod : undefined,
        campus_id: selectedCampus?.id,
      });
      if (res.success && res.data) {
        setTeachers(res.data);
      }
    } catch {
      toast.error("Failed to load teacher completion data");
    } finally {
      setLoading(false);
    }
  }, [user, selectedMp, selectedPeriod, selectedCampus?.id]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // ── Collect all unique period IDs from teacher data ────────────
  const allPeriodIds = Array.from(
    new Set(teachers.flatMap((t) => Object.keys(t.periods)))
  );

  // Build columns from school periods that appear in the data
  const periodColumns = schoolPeriods.length > 0
    ? schoolPeriods.filter((sp) => allPeriodIds.includes(sp.id))
    : allPeriodIds.map((id) => ({
        id,
        title: teachers.find((t) => t.periods[id])?.periods[id]?.period_title || id,
      }));

  // ── Filtered teachers ──────────────────────────────────────────
  const filteredTeachers = debouncedSearch
    ? teachers.filter((t) =>
        t.teacher_name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : teachers;

  const currentMpTitle =
    markingPeriods.find((m) => m.id === selectedMp)?.title || "";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <CheckSquare className="h-8 w-8 text-[#57A3CC]" />
          Teacher Completion
        </h1>
        <p className="text-muted-foreground mt-2">
          Track which teachers have completed grade entry
          {selectedCampus && (
            <span className="ml-1 font-medium">— {selectedCampus.name}</span>
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
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground pb-2">—</span>
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Period
              </Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {schoolPeriods.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher Completion Table */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#0369a1] font-medium">
              {filteredTeachers.length} teacher
              {filteredTeachers.length !== 1 ? "s" : ""} who enter grades were
              found.
            </p>
            <div className="relative w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No teachers found</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                    <TableHead className="text-white font-semibold">
                      TEACHER
                    </TableHead>
                    {selectedPeriod === "all" ? (
                      // Show all period columns
                      periodColumns.map((col) => (
                        <TableHead
                          key={col.id}
                          className="text-white font-semibold text-center"
                        >
                          {col.title.toUpperCase()}
                        </TableHead>
                      ))
                    ) : (
                      // Single period: show Course Period + Completed
                      <>
                        <TableHead className="text-white font-semibold">
                          COURSE PERIOD
                        </TableHead>
                        <TableHead className="text-white font-semibold text-center">
                          COMPLETED
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.map((teacher, idx) => (
                    <TableRow
                      key={teacher.staff_id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <TableCell className="font-medium">
                        {teacher.teacher_name}
                      </TableCell>
                      {selectedPeriod === "all" ? (
                        periodColumns.map((col) => {
                          const entry = teacher.periods[col.id];
                          if (!entry) {
                            return (
                              <TableCell
                                key={col.id}
                                className="text-center"
                              >
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell
                              key={col.id}
                              className="text-center"
                            >
                              {entry.completed ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })
                      ) : (
                        <>
                          {/* When single period selected, flatten entries */}
                          {Object.values(teacher.periods).map((entry, i) => (
                            <TableCell key={i}>
                              {entry.course_period_title || "—"}
                            </TableCell>
                          ))}
                          {Object.values(teacher.periods).map((entry, i) => (
                            <TableCell key={`c-${i}`} className="text-center">
                              {entry.completed ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              )}
                            </TableCell>
                          ))}
                        </>
                      )}
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
