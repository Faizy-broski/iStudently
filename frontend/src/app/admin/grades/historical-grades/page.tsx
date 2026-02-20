"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  BookOpen,
  Search,
  Plus,
  Minus,
  Save,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import { getStudents } from "@/lib/api/students";
import type {
  HistoricalGradeMP,
  HistoricalGradeEntry,
  HistoryMarkingPeriod,
} from "@/lib/api/grades";

// ── Row type ────────────────────────────────────────────────────
interface GradeRow extends HistoricalGradeEntry {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface StudentListItem {
  id: string;
  name: string;
  student_number?: string;
  grade_level?: string;
}

export default function HistoricalGradesPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Student list (initial view) ───────────────────────────────
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] =
    useState<StudentListItem | null>(null);

  // ── MPs and grades ────────────────────────────────────────────
  const [mps, setMps] = useState<HistoricalGradeMP[]>([]);
  const [activeMp, setActiveMp] = useState("");
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loadingMps, setLoadingMps] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Available marking periods (for add dropdown) ──────────────
  const [availableMps, setAvailableMps] = useState<HistoryMarkingPeriod[]>([]);
  const [loadingAvailableMps, setLoadingAvailableMps] = useState(false);

  // ── Add MP panel ──────────────────────────────────────────────
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addMpId, setAddMpId] = useState("");
  const [addGradeLevel, setAddGradeLevel] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  // ── Edit MP grade level ───────────────────────────────────────
  const [editGradeLevel, setEditGradeLevel] = useState("");

  // ── New row fields ────────────────────────────────────────────
  const [newCourse, setNewCourse] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newPercent, setNewPercent] = useState("");
  const [newGpScale, setNewGpScale] = useState("");
  const [newCreditAttempted, setNewCreditAttempted] = useState("");
  const [newCreditEarned, setNewCreditEarned] = useState("");
  const [newComment, setNewComment] = useState("");

  // ── Load all students on mount / campus change ────────────────
  const loadStudents = useCallback(async () => {
    if (!user) return;
    setLoadingStudents(true);
    try {
      const res = await getStudents({
        campus_id: selectedCampus?.id,
        limit: 1000,
      });
      if (res.success && Array.isArray(res.data)) {
        setStudents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res.data as Record<string, any>[]).map((s: Record<string, any>) => ({
            id: s.id,
            name:
              [s.first_name || s.profile?.first_name, s.father_name || s.profile?.father_name, s.last_name || s.profile?.last_name]
                .filter(Boolean)
                .join(" ") || "Unknown",
            student_number: s.student_number || s.student_id || s.admission_number,
            grade_level: s.grade_level || s.class_name,
          }))
        );
      }
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoadingStudents(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // ── Filtered students by search ───────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.student_number && s.student_number.toLowerCase().includes(q)) ||
        (s.grade_level && s.grade_level.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // ── Load available history marking periods (when student selected) ──
  const loadAvailableMps = useCallback(async () => {
    setLoadingAvailableMps(true);
    try {
      const res = await gradesApi.getHistoryMarkingPeriods(selectedCampus?.id);
      if (res.success && res.data) {
        setAvailableMps(res.data);
      }
    } catch {
      // silent
    } finally {
      setLoadingAvailableMps(false);
    }
  }, [selectedCampus?.id]);

  useEffect(() => {
    if (selectedStudent) {
      loadAvailableMps();
    }
  }, [selectedStudent, loadAvailableMps]);

  // ── Load marking periods for selected student ─────────────────
  const loadMPs = useCallback(async () => {
    if (!selectedStudent || !user) return;
    setLoadingMps(true);
    try {
      const res = await gradesApi.getHistoricalGradeMPs(
        selectedStudent.id
      );
      if (res.success && res.data) {
        setMps(res.data);
        if (res.data.length > 0 && !activeMp) {
          setActiveMp(res.data[0].mp_id);
        }
      }
    } catch {
      toast.error("Failed to load marking periods");
    } finally {
      setLoadingMps(false);
    }
  }, [selectedStudent, user, activeMp]);

  useEffect(() => {
    if (selectedStudent) {
      loadMPs();
    }
  }, [selectedStudent, loadMPs]);

  // ── Load grades for active MP ─────────────────────────────────
  const loadGrades = useCallback(async () => {
    if (!selectedStudent || !activeMp || !user) return;
    setLoadingGrades(true);
    try {
      const res = await gradesApi.getHistoricalGrades(
        selectedStudent.id,
        activeMp
      );
      if (res.success && res.data) {
        setRows(res.data.map((g) => ({ ...g })));
      }
    } catch {
      toast.error("Failed to load grades");
    } finally {
      setLoadingGrades(false);
    }
  }, [selectedStudent, activeMp, user]);

  useEffect(() => {
    if (activeMp) {
      loadGrades();
      // Sync grade level for the active MP
      const mp = mps.find((m) => m.mp_id === activeMp);
      setEditGradeLevel(mp?.grade_level || "");
    }
  }, [activeMp, loadGrades, mps]);

  // ── Handle student selection ────────────────────────────────
  const handleSelectStudent = (student: StudentListItem) => {
    setSelectedStudent(student);
    setActiveMp("");
    setMps([]);
    setRows([]);
    setShowAddPanel(false);
  };

  // ── Handle back to list ───────────────────────────────────────
  const handleBackToList = () => {
    setSelectedStudent(null);
    setMps([]);
    setRows([]);
    setActiveMp("");
    setShowAddPanel(false);
  };

  // ── Handle add marking period dropdown change ─────────────────
  const handleAddMpSelect = (mpId: string) => {
    setAddMpId(mpId);
    setAddGradeLevel("");
    setShowAddPanel(true);
  };

  // ── Save new marking period to student ────────────────────────
  const handleSaveAddMp = async () => {
    if (!selectedStudent || !addMpId) return;
    setAddingSaving(true);
    try {
      const res = await gradesApi.addHistoricalMP(selectedStudent.id, {
        marking_period_id: addMpId,
        grade_level: addGradeLevel || undefined,
      });
      if (res.success) {
        toast.success("Marking period added");
        setShowAddPanel(false);
        setAddMpId("");
        setAddGradeLevel("");
        const mpRes = await gradesApi.getHistoricalGradeMPs(selectedStudent.id);
        if (mpRes.success && mpRes.data) {
          setMps(mpRes.data);
          const newMp = mpRes.data.find(
            (m) => !mps.some((existing) => existing.mp_id === m.mp_id)
          );
          if (newMp) setActiveMp(newMp.mp_id);
        }
      } else {
        toast.error(res.error || "Failed to add marking period");
      }
    } catch {
      toast.error("Failed to add marking period");
    } finally {
      setAddingSaving(false);
    }
  };

  // ── Remove marking period from student ────────────────────────
  const handleRemoveMp = async () => {
    if (!selectedStudent || !activeMp) return;
    const mp = mps.find((m) => m.mp_id === activeMp);
    if (
      !confirm(
        `Remove marking period "${mp?.mp_name || "Unknown"}" and all its grades from this student?`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await gradesApi.removeHistoricalMP(
        selectedStudent.id,
        activeMp
      );
      if (res.success) {
        toast.success("Marking period removed");
        setActiveMp("");
        setRows([]);
        const mpRes = await gradesApi.getHistoricalGradeMPs(selectedStudent.id);
        if (mpRes.success && mpRes.data) {
          setMps(mpRes.data);
          if (mpRes.data.length > 0) {
            setActiveMp(mpRes.data[0].mp_id);
          }
        }
      } else {
        toast.error(res.error || "Failed to remove marking period");
      }
    } catch {
      toast.error("Failed to remove marking period");
    } finally {
      setSaving(false);
    }
  };

  // ── Row helpers ───────────────────────────────────────────────
  const updateRow = (
    idx: number,
    field: keyof GradeRow,
    value: string | number | null
  ) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, _dirty: true } : r
      )
    );
  };

  const markDelete = (idx: number) => {
    const row = rows[idx];
    if (!row.id || row._isNew) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, _deleted: true } : r))
      );
    }
  };

  const addRow = () => {
    if (!newCourse.trim()) {
      toast.error("Course title is required");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        course_title: newCourse.trim(),
        grade_letter: newGrade.trim() || null,
        grade_percent: newPercent ? parseFloat(newPercent) : null,
        gp_scale: newGpScale ? parseFloat(newGpScale) : null,
        credit_attempted: newCreditAttempted
          ? parseFloat(newCreditAttempted)
          : null,
        credit_earned: newCreditEarned
          ? parseFloat(newCreditEarned)
          : null,
        comment: newComment.trim() || null,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewCourse("");
    setNewGrade("");
    setNewPercent("");
    setNewGpScale("");
    setNewCreditAttempted("");
    setNewCreditEarned("");
    setNewComment("");
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    let errors = 0;
    try {
      for (const row of rows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteHistoricalGrade(row.id);
        if (!res.success) errors++;
      }
      for (const row of rows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createHistoricalGrade(
          selectedStudent.id,
          activeMp,
          {
            course_title: row.course_title,
            grade_letter: row.grade_letter || undefined,
            grade_percent: row.grade_percent ?? undefined,
            gp_scale: row.gp_scale ?? undefined,
            credit_attempted: row.credit_attempted ?? undefined,
            credit_earned: row.credit_earned ?? undefined,
            comment: row.comment || undefined,
          }
        );
        if (!res.success) errors++;
      }
      for (const row of rows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateHistoricalGrade(row.id, {
          course_title: row.course_title,
          grade_letter: row.grade_letter,
          grade_percent: row.grade_percent,
          gp_scale: row.gp_scale,
          credit_attempted: row.credit_attempted,
          credit_earned: row.credit_earned,
          comment: row.comment,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("Grades saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadGrades();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = rows.some((r) => r._dirty || r._deleted || r._isNew);
  const visibleRows = rows.filter((r) => !r._deleted);

  // ── Compute GPA stats ─────────────────────────────────────────
  const gradeStats = (() => {
    const graded = visibleRows.filter((r) => r.gp_scale !== null);
    const totalCreditsAttempted = visibleRows.reduce(
      (s, r) => s + (r.credit_attempted ?? 0),
      0
    );
    const totalCreditsEarned = visibleRows.reduce(
      (s, r) => s + (r.credit_earned ?? 0),
      0
    );
    const weightedGP =
      graded.length > 0
        ? graded.reduce((s, r) => s + (r.gp_scale ?? 0), 0) / graded.length
        : 0;
    return {
      gpa: weightedGP.toFixed(2),
      creditsAttempted: totalCreditsAttempted.toFixed(1),
      creditsEarned: totalCreditsEarned.toFixed(1),
      courseCount: visibleRows.length,
    };
  })();

  // ── Get the display label for an available MP ─────────────────
  const getMpLabel = (mp: HistoryMarkingPeriod) =>
    `${mp.school_year}, ${mp.name}`;

  // ── Filter available MPs to exclude already-added ones ────────
  const filteredAvailableMps = availableMps.filter(
    (amp) => !mps.some((m) => m.mp_id === amp.id)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedStudent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToList}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-[#57A3CC]" />
            Historical Grades
          </h1>
          {selectedStudent ? (
            <p className="text-muted-foreground mt-1">
              {selectedStudent.name}
              {selectedStudent.student_number && (
                <span className="ml-2 text-sm">
                  (ID: {selectedStudent.student_number})
                </span>
              )}
              {selectedStudent.grade_level && (
                <span className="ml-2 text-sm">
                  — {selectedStudent.grade_level}
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1">
              Select a student to view and edit historical grade records
              {selectedCampus && (
                <span className="ml-1 font-medium">
                  — {selectedCampus.name}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ═══════════════ STUDENT LIST VIEW ═══════════════ */}
      {!selectedStudent && (
        <Card>
          <CardContent className="pt-6">
            {/* Search + count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found.
              </p>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="pl-10 h-9"
                />
              </div>
            </div>

            {loadingStudents ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0369a1] text-white">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-4">
                        Student
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-4">
                        Student ID
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-4">
                        Grade Level
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, idx) => (
                      <tr
                        key={student.id}
                        onClick={() => handleSelectStudent(student)}
                        className={`border-b cursor-pointer hover:bg-blue-50 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="text-[#0369a1] hover:underline font-medium">
                            {student.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {student.student_number || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {student.grade_level || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════ STUDENT DETAIL VIEW (Historical Grades Editing) ═══════════════ */}
      {selectedStudent && (
        <>
          {/* Add Another Marking Period Dropdown */}
          <div className="flex items-center gap-4">
            <Select
              onValueChange={handleAddMpSelect}
              value=""
              disabled={loadingAvailableMps}
            >
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Add another marking period" />
              </SelectTrigger>
              <SelectContent>
                {filteredAvailableMps.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No marking periods available to add
                  </SelectItem>
                ) : (
                  filteredAvailableMps.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {getMpLabel(mp)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {hasDirty && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                size="sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            )}
          </div>

          {/* Add MP Panel (centered card) */}
          {showAddPanel && (
            <div className="flex justify-center">
              <Card className="w-full max-w-lg">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-lg font-bold text-center uppercase tracking-wide text-[#0369a1]">
                    Add Another Marking Period
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        New Marking Period
                      </label>
                      <Select value={addMpId} onValueChange={setAddMpId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select marking period" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredAvailableMps.map((mp) => (
                            <SelectItem key={mp.id} value={mp.id}>
                              {getMpLabel(mp)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Grade Level
                      </label>
                      <Input
                        value={addGradeLevel}
                        onChange={(e) => setAddGradeLevel(e.target.value)}
                        placeholder="e.g. 10"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddPanel(false);
                        setAddMpId("");
                        setAddGradeLevel("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveAddMp}
                      disabled={addingSaving || !addMpId}
                      className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                    >
                      {addingSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Marking Period Tabs + Grades */}
          {loadingMps ? (
            <Skeleton className="h-10 w-full" />
          ) : mps.length === 0 && !showAddPanel ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>
                  No historical marking periods found for this student.
                  Use the dropdown above to add one.
                </p>
              </CardContent>
            </Card>
          ) : mps.length > 0 ? (
            <Tabs
              value={activeMp}
              onValueChange={(v) => setActiveMp(v)}
              className="space-y-4"
            >
              <TabsList className="flex-wrap">
                {mps.map((mp) => (
                  <TabsTrigger key={mp.mp_id} value={mp.mp_id}>
                    {mp.mp_name}
                    {mp.school_year && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({mp.school_year})
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {mps.map((mp) => (
                <TabsContent key={mp.mp_id} value={mp.mp_id}>
                  {/* MP Info Card */}
                  <Card className="mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              Marking Period
                            </p>
                            <p className="font-semibold text-[#0369a1]">
                              {mp.mp_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              School Year
                            </p>
                            <p className="font-semibold">{mp.school_year}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                Grade Level
                              </p>
                              <Input
                                value={editGradeLevel}
                                onChange={(e) => setEditGradeLevel(e.target.value)}
                                className="h-8 w-24 text-sm"
                                placeholder="—"
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={handleRemoveMp}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Marking Period
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* GPA Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <Card>
                      <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-2xl font-bold text-[#0369a1]">
                          {gradeStats.gpa}
                        </p>
                        <p className="text-xs text-muted-foreground">GPA</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-2xl font-bold text-[#0369a1]">
                          {gradeStats.courseCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Courses
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-2xl font-bold text-[#0369a1]">
                          {gradeStats.creditsAttempted}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Credits Attempted
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-2xl font-bold text-[#0369a1]">
                          {gradeStats.creditsEarned}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Credits Earned
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-[#0369a1] font-medium">
                          {visibleRows.length} grade entr
                          {visibleRows.length !== 1 ? "ies" : "y"}
                        </p>
                        <Button
                          onClick={handleSave}
                          disabled={saving || !hasDirty}
                          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                          size="sm"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>

                      {loadingGrades ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-[#0369a1] text-white">
                                <th className="w-8 py-3 px-2" />
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                                  Course Title
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-24">
                                  Grade
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-24">
                                  %
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                                  GP
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-24">
                                  Cr. Att.
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-24">
                                  Cr. Earn.
                                </th>
                                <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                                  Comment
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map((row, idx) => {
                                const actualIdx = rows.indexOf(row);
                                return (
                                  <tr
                                    key={row.id}
                                    className={`border-b hover:bg-muted/30 ${
                                      idx % 2 === 0
                                        ? "bg-white"
                                        : "bg-gray-50"
                                    }`}
                                  >
                                    <td className="py-2 px-1">
                                      <button
                                        onClick={() =>
                                          markDelete(actualIdx)
                                        }
                                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        value={row.course_title}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "course_title",
                                            e.target.value
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        value={row.grade_letter ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "grade_letter",
                                            e.target.value || null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        type="number"
                                        value={row.grade_percent ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "grade_percent",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={row.gp_scale ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "gp_scale",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        type="number"
                                        step="0.5"
                                        value={row.credit_attempted ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "credit_attempted",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        type="number"
                                        step="0.5"
                                        value={row.credit_earned ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "credit_earned",
                                            e.target.value
                                              ? parseFloat(e.target.value)
                                              : null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <Input
                                        value={row.comment ?? ""}
                                        onChange={(e) =>
                                          updateRow(
                                            actualIdx,
                                            "comment",
                                            e.target.value || null
                                          )
                                        }
                                        className="h-8 text-sm"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Add row */}
                              <tr className="border-b bg-muted/20">
                                <td className="py-2 px-1">
                                  <button
                                    onClick={addRow}
                                    className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={newCourse}
                                    onChange={(e) =>
                                      setNewCourse(e.target.value)
                                    }
                                    placeholder="Course title"
                                    className="h-8 text-sm"
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && addRow()
                                    }
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={newGrade}
                                    onChange={(e) =>
                                      setNewGrade(e.target.value)
                                    }
                                    placeholder="A+"
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    value={newPercent}
                                    onChange={(e) =>
                                      setNewPercent(e.target.value)
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={newGpScale}
                                    onChange={(e) =>
                                      setNewGpScale(e.target.value)
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    value={newCreditAttempted}
                                    onChange={(e) =>
                                      setNewCreditAttempted(e.target.value)
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    value={newCreditEarned}
                                    onChange={(e) =>
                                      setNewCreditEarned(e.target.value)
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={newComment}
                                    onChange={(e) =>
                                      setNewComment(e.target.value)
                                    }
                                    placeholder="Comment"
                                    className="h-8 text-sm"
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="flex justify-center pt-4">
                        <Button
                          onClick={handleSave}
                          disabled={saving || !hasDirty}
                          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                          size="sm"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          ) : null}
        </>
      )}
    </div>
  );
}
