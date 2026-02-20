"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Award,
  Plus,
  Minus,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type {
  GraduationPath,
  GraduationPathGradeLevel,
  GraduationPathSubject,
  GraduationPathStudent,
} from "@/lib/api/grades";
import { getGradeLevels, getSubjects } from "@/lib/api/academics";
import type { GradeLevel, Subject } from "@/lib/api/academics";
import { getStudents } from "@/lib/api/students";
import type { Student } from "@/lib/api/students";

// ── Row type with dirty tracking ────────────────────────────────
interface PathRow extends GraduationPath {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

// ── Assign Grade Levels Dialog ──────────────────────────────────
function AssignGradeLevelsDialog({
  open,
  onOpenChange,
  path,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: GraduationPath;
  onAssigned: () => void;
}) {
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setLoading(true);
    (async () => {
      try {
        const res = await getGradeLevels();
        if (res.success && res.data) {
          const assignedIds = new Set(
            (path.grade_levels ?? []).map((gl) => gl.grade_level_id)
          );
          setGradeLevels(res.data.filter((gl) => !assignedIds.has(gl.id)));
        }
      } catch {
        toast.error("Failed to load grade levels");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, path]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await gradesApi.assignGradeLevels(
        path.id,
        Array.from(selected)
      );
      if (res.success) {
        toast.success("Grade levels assigned");
        onAssigned();
        onOpenChange(false);
      } else {
        toast.error("Failed to assign grade levels");
      }
    } catch {
      toast.error("Failed to assign grade levels");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign Grade Levels — {path.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : gradeLevels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All grade levels are already assigned.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {gradeLevels.map((gl) => (
              <label
                key={gl.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selected.has(gl.id)}
                  onCheckedChange={() => toggle(gl.id)}
                />
                <span className="text-sm">{gl.name}</span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selected.size === 0 || saving}
            className="bg-[#0369a1] hover:bg-[#0369a1]/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Subjects Dialog ──────────────────────────────────────
function AssignSubjectsDialog({
  open,
  onOpenChange,
  path,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: GraduationPath;
  onAssigned: () => void;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<
    Map<string, { subject: Subject; credits: number }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setLoading(true);
    (async () => {
      try {
        const res = await getSubjects();
        if (res.success && res.data) {
          const assignedIds = new Set(
            (path.subjects ?? []).map((s) => s.subject_id)
          );
          setSubjects(res.data.filter((s) => !assignedIds.has(s.id)));
        }
      } catch {
        toast.error("Failed to load subjects");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, path]);

  const toggle = (subj: Subject) => {
    const next = new Map(selected);
    if (next.has(subj.id)) next.delete(subj.id);
    else next.set(subj.id, { subject: subj, credits: 3 });
    setSelected(next);
  };

  const setCredits = (id: string, credits: number) => {
    const next = new Map(selected);
    const entry = next.get(id);
    if (entry) {
      next.set(id, { ...entry, credits });
      setSelected(next);
    }
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const items = Array.from(selected.entries()).map(([id, { credits }]) => ({
        subject_id: id,
        credits,
      }));
      const res = await gradesApi.assignPathSubjects(path.id, items);
      if (res.success) {
        toast.success("Subjects assigned");
        onAssigned();
        onOpenChange(false);
      } else {
        toast.error("Failed to assign subjects");
      }
    } catch {
      toast.error("Failed to assign subjects");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign Subjects — {path.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            All subjects are already assigned.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {subjects.map((subj) => {
              const entry = selected.get(subj.id);
              return (
                <div
                  key={subj.id}
                  className={`flex items-center gap-3 p-2 rounded hover:bg-muted ${
                    entry ? "bg-blue-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={!!entry}
                    onCheckedChange={() => toggle(subj)}
                  />
                  <span className="text-sm flex-1">
                    {subj.name}
                    {subj.code && (
                      <span className="text-muted-foreground ml-1">
                        ({subj.code})
                      </span>
                    )}
                  </span>
                  {entry && (
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      className="w-20 h-7 text-xs"
                      value={entry.credits}
                      onChange={(e) =>
                        setCredits(subj.id, parseFloat(e.target.value) || 0)
                      }
                      placeholder="Credits"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selected.size === 0 || saving}
            className="bg-[#0369a1] hover:bg-[#0369a1]/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Students Dialog ──────────────────────────────────────
function AssignStudentsDialog({
  open,
  onOpenChange,
  path,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: GraduationPath;
  onAssigned: () => void;
}) {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearchQuery("");
    setLoading(true);
    (async () => {
      try {
        const res = await getStudents({
          limit: 500,
          campus_id: selectedCampus?.id,
        });
        if (res.success && res.data) {
          const assignedIds = new Set(
            (path.students ?? []).map((s) => s.student_id)
          );
          setStudents(
            (res.data as Student[]).filter((s) => !assignedIds.has(s.id))
          );
        }
      } catch {
        toast.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, path, selectedCampus?.id]);

  const filtered = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${s.profile?.first_name ?? ""} ${s.profile?.last_name ?? ""}`.toLowerCase();
    return (
      name.includes(q) ||
      s.student_number?.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const res = await gradesApi.assignPathStudents(
        path.id,
        Array.from(selected)
      );
      if (res.success) {
        toast.success("Students assigned");
        onAssigned();
        onOpenChange(false);
      } else {
        toast.error("Failed to assign students");
      }
    } catch {
      toast.error("Failed to assign students");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign Students — {path.title}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {students.length === 0
              ? "All students are already assigned."
              : "No students match your search."}
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filtered.map((s) => (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer ${
                  selected.has(s.id) ? "bg-blue-50" : ""
                }`}
              >
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
                <span className="text-sm flex-1">
                  {s.profile?.first_name ?? ""} {s.profile?.last_name ?? ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.student_number}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selected.size === 0 || saving}
            className="bg-[#0369a1] hover:bg-[#0369a1]/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Selected ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── View Assigned Items Dialog (Grade Levels / Subjects / Students) ─
function ViewAssignedDialog({
  open,
  onOpenChange,
  path,
  type,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: GraduationPath;
  type: "grade_levels" | "subjects" | "students";
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);

  const items =
    type === "grade_levels"
      ? path.grade_levels ?? []
      : type === "subjects"
      ? path.subjects ?? []
      : path.students ?? [];

  const title =
    type === "grade_levels"
      ? "Grade Levels"
      : type === "subjects"
      ? "Subjects"
      : "Students";

  const handleRemove = async (itemId: string) => {
    setRemoving(itemId);
    try {
      let res;
      if (type === "grade_levels") {
        res = await gradesApi.removePathGradeLevel(path.id, itemId);
      } else if (type === "subjects") {
        res = await gradesApi.removePathSubject(path.id, itemId);
      } else {
        res = await gradesApi.removePathStudent(path.id, itemId);
      }
      if (res.success) {
        toast.success("Removed successfully");
        onRemoved();
      } else {
        toast.error("Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    } finally {
      setRemoving(null);
    }
  };

  const getItemLabel = (item: GraduationPathGradeLevel | GraduationPathSubject | GraduationPathStudent) => {
    if (type === "grade_levels") {
      return (item as GraduationPathGradeLevel).grade_level?.name ?? "Unknown";
    }
    if (type === "subjects") {
      const s = item as GraduationPathSubject;
      return `${s.subject?.name ?? "Unknown"} (${s.credits} credits)`;
    }
    const st = item as GraduationPathStudent;
    return `${st.student?.profile?.first_name ?? ""} ${st.student?.profile?.last_name ?? ""}`.trim() || st.student?.student_number || "Unknown";
  };

  const getItemRemoveId = (item: GraduationPathGradeLevel | GraduationPathSubject | GraduationPathStudent) => {
    if (type === "grade_levels") return (item as GraduationPathGradeLevel).grade_level_id;
    if (type === "subjects") return (item as GraduationPathSubject).subject_id;
    return (item as GraduationPathStudent).student_id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title} — {path.title}
          </DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No {title.toLowerCase()} assigned.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto space-y-1">
            {items.map((item) => {
              const removeId = getItemRemoveId(item);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted"
                >
                  <span className="text-sm">{getItemLabel(item)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleRemove(removeId)}
                    disabled={removing === removeId}
                  >
                    {removing === removeId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════
export default function GraduationPathsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [rows, setRows] = useState<PathRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── New row fields ────────────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");

  // ── Dialog state ──────────────────────────────────────────────
  const [assignGLPath, setAssignGLPath] = useState<GraduationPath | null>(null);
  const [assignSubjPath, setAssignSubjPath] = useState<GraduationPath | null>(null);
  const [assignStudPath, setAssignStudPath] = useState<GraduationPath | null>(null);
  const [viewDialog, setViewDialog] = useState<{
    path: GraduationPath;
    type: "grade_levels" | "subjects" | "students";
  } | null>(null);

  // ── Load data ─────────────────────────────────────────────────
  const loadPaths = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await gradesApi.getGraduationPaths(selectedCampus?.id);
      if (res.success && res.data) {
        setRows(res.data.map((p) => ({ ...p })));
      }
    } catch {
      toast.error("Failed to load graduation paths");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadPaths();
  }, [loadPaths]);

  // ── Row mutations ─────────────────────────────────────────────
  const updateRow = (idx: number, field: "title" | "comment", value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, _dirty: true } : r
      )
    );
  };

  const markDeleted = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (r._isNew) return { ...r, _deleted: true };
        return { ...r, _deleted: !r._deleted, _dirty: true };
      })
    );
  };

  const addRow = () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    const tempId = `new-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      {
        id: tempId,
        school_id: "",
        title: newTitle.trim(),
        comment: newComment.trim() || null,
        is_active: true,
        _isNew: true,
        _dirty: true,
      } as PathRow,
    ]);
    setNewTitle("");
    setNewComment("");
  };

  // ── Derived state ─────────────────────────────────────────────
  const hasDirty = rows.some((r) => r._dirty || r._isNew || r._deleted);
  const activeRows = rows.filter((r) => !(r._isNew && r._deleted));

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of rows) {
        if (row._isNew && row._deleted) continue;

        if (row._deleted && !row._isNew) {
          await gradesApi.deleteGraduationPath(row.id);
          continue;
        }

        if (row._isNew) {
          await gradesApi.createGraduationPath({
            title: row.title,
            comment: row.comment ?? undefined,
          });
          continue;
        }

        if (row._dirty) {
          await gradesApi.updateGraduationPath(row.id, {
            title: row.title,
            comment: row.comment ?? undefined,
          });
        }
      }
      toast.success("Graduation paths saved");
      await loadPaths();
    } catch {
      toast.error("Failed to save graduation paths");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#0369a1] to-[#0284c7] flex items-center justify-center">
          <Award className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">
            Graduation Paths
          </h1>
          <p className="text-sm text-muted-foreground">
            Define graduation requirements with grade levels, subjects, and student assignments
          </p>
        </div>
      </div>

      {/* Count badge */}
      {!loading && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Award className="h-3 w-3 mr-1" />
            {activeRows.filter((r) => !r._isNew).length} graduation path
            {activeRows.filter((r) => !r._isNew).length !== 1 ? "s" : ""} found
          </Badge>
        </div>
      )}

      {/* Table card */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0369a1] text-white">
                    <th className="w-10 px-3 py-2.5"></th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      TITLE
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      COMMENT
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      GRADE LEVELS
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      SUBJECTS
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      STUDENTS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row, idx) => {
                    const realIdx = rows.indexOf(row);
                    const glNames = (row.grade_levels ?? [])
                      .map((gl) => gl.grade_level?.name)
                      .filter(Boolean)
                      .join(", ");
                    const subjCount = row.subject_count ?? (row.subjects?.length ?? 0);
                    const studCount = row.student_count ?? (row.students?.length ?? 0);

                    return (
                      <tr
                        key={row.id}
                        className={`border-b last:border-b-0 ${
                          row._deleted
                            ? "bg-red-50 line-through opacity-60"
                            : row._isNew
                            ? "bg-green-50"
                            : row._dirty
                            ? "bg-yellow-50"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {/* Delete button */}
                        <td className="px-3 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => markDeleted(realIdx)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </td>

                        {/* Title */}
                        <td className="px-3 py-2">
                          <Input
                            value={row.title}
                            onChange={(e) =>
                              updateRow(realIdx, "title", e.target.value)
                            }
                            className="h-8 text-sm"
                            disabled={row._deleted}
                          />
                        </td>

                        {/* Comment */}
                        <td className="px-3 py-2">
                          <Input
                            value={row.comment ?? ""}
                            onChange={(e) =>
                              updateRow(realIdx, "comment", e.target.value)
                            }
                            className="h-8 text-sm"
                            disabled={row._deleted}
                          />
                        </td>

                        {/* Grade Levels */}
                        <td className="px-3 py-2">
                          {row._isNew ? (
                            <span className="text-xs text-muted-foreground italic">
                              Save first
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={() => setAssignGLPath(row)}
                                className="text-[#0369a1] hover:underline text-xs font-medium"
                              >
                                Assign
                              </button>
                              {glNames && (
                                <>
                                  <span className="text-muted-foreground">|</span>
                                  <button
                                    onClick={() =>
                                      setViewDialog({
                                        path: row,
                                        type: "grade_levels",
                                      })
                                    }
                                    className="text-xs text-muted-foreground hover:underline"
                                  >
                                    {glNames}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Subjects */}
                        <td className="px-3 py-2">
                          {row._isNew ? (
                            <span className="text-xs text-muted-foreground italic">
                              Save first
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setAssignSubjPath(row)}
                                className="text-[#0369a1] hover:underline text-xs font-medium"
                              >
                                Assign
                              </button>
                              {subjCount > 0 && (
                                <>
                                  <span className="text-muted-foreground">|</span>
                                  <button
                                    onClick={() =>
                                      setViewDialog({
                                        path: row,
                                        type: "subjects",
                                      })
                                    }
                                    className="text-xs text-muted-foreground hover:underline"
                                  >
                                    {subjCount}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Students */}
                        <td className="px-3 py-2">
                          {row._isNew ? (
                            <span className="text-xs text-muted-foreground italic">
                              Save first
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setAssignStudPath(row)}
                                className="text-[#0369a1] hover:underline text-xs font-medium"
                              >
                                Assign
                              </button>
                              {studCount > 0 && (
                                <>
                                  <span className="text-muted-foreground">|</span>
                                  <button
                                    onClick={() =>
                                      setViewDialog({
                                        path: row,
                                        type: "students",
                                      })
                                    }
                                    className="text-xs text-muted-foreground hover:underline"
                                  >
                                    {studCount}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Add row */}
                  <tr className="bg-muted/30">
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                        onClick={addRow}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Title"
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && addRow()}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Comment"
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && addRow()}
                      />
                    </td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={!hasDirty || saving}
          className="bg-[#0369a1] hover:bg-[#0369a1]/90 px-8"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────── */}
      {assignGLPath && (
        <AssignGradeLevelsDialog
          open={!!assignGLPath}
          onOpenChange={(open) => !open && setAssignGLPath(null)}
          path={assignGLPath}
          onAssigned={loadPaths}
        />
      )}

      {assignSubjPath && (
        <AssignSubjectsDialog
          open={!!assignSubjPath}
          onOpenChange={(open) => !open && setAssignSubjPath(null)}
          path={assignSubjPath}
          onAssigned={loadPaths}
        />
      )}

      {assignStudPath && (
        <AssignStudentsDialog
          open={!!assignStudPath}
          onOpenChange={(open) => !open && setAssignStudPath(null)}
          path={assignStudPath}
          onAssigned={loadPaths}
        />
      )}

      {viewDialog && (
        <ViewAssignedDialog
          open={!!viewDialog}
          onOpenChange={(open) => !open && setViewDialog(null)}
          path={viewDialog.path}
          type={viewDialog.type}
          onRemoved={loadPaths}
        />
      )}
    </div>
  );
}
