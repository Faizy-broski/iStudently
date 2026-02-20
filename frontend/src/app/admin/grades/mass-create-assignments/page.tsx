"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ClipboardList,
  Plus,
  Check,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type {
  GradebookAssignmentType,
  CoursePeriod,
  MarkingPeriodOption,
} from "@/lib/api/grades";

export default function MassCreateAssignmentsPage() {
  useAuth(); // ensure authenticated
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Assignment Types ──────────────────────────────────────────
  const [assignmentTypes, setAssignmentTypes] = useState<
    GradebookAssignmentType[]
  >([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [savingType, setSavingType] = useState(false);

  // ── Course Periods ────────────────────────────────────────────
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [loadingCps, setLoadingCps] = useState(false);
  const [selectedCpIds, setSelectedCpIds] = useState<Set<string>>(new Set());

  // ── Marking Periods (for display) ─────────────────────────────
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodOption[]>(
    []
  );

  // ── Assignment Form ───────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [defaultPoints, setDefaultPoints] = useState("");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [assignedDate, setAssignedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState("");
  const [enableSubmission, setEnableSubmission] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Load Assignment Types ─────────────────────────────────────
  const loadAssignmentTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const res = await gradesApi.getGradebookAssignmentTypes(
        selectedCampus?.id
      );
      if (res.success && res.data) {
        setAssignmentTypes(res.data);
        if (res.data.length > 0 && !selectedTypeId) {
          setSelectedTypeId(res.data[0].id);
        }
      }
    } catch {
      toast.error("Failed to load assignment types");
    } finally {
      setLoadingTypes(false);
    }
  }, [selectedCampus?.id, selectedTypeId]);

  // ── Load Course Periods ───────────────────────────────────────
  const loadCoursePeriods = useCallback(async () => {
    setLoadingCps(true);
    try {
      const res = await gradesApi.getCoursePeriods(selectedCampus?.id);
      if (res.success && res.data) {
        setCoursePeriods(res.data);
      }
    } catch {
      toast.error("Failed to load course periods");
    } finally {
      setLoadingCps(false);
    }
  }, [selectedCampus?.id]);

  // ── Load Marking Periods ──────────────────────────────────────
  const loadMarkingPeriods = useCallback(async () => {
    try {
      const res = await gradesApi.getMarkingPeriods(selectedCampus?.id);
      if (res.success && res.data) {
        setMarkingPeriods(res.data);
      }
    } catch {
      // silent
    }
  }, [selectedCampus?.id]);

  useEffect(() => {
    loadAssignmentTypes();
    loadCoursePeriods();
    loadMarkingPeriods();
  }, [loadAssignmentTypes, loadCoursePeriods, loadMarkingPeriods]);

  // ── Create new assignment type ────────────────────────────────
  const handleCreateType = async () => {
    if (!newTypeName.trim()) return;
    setSavingType(true);
    try {
      const res = await gradesApi.createGradebookAssignmentType({
        title: newTypeName.trim(),
        sort_order: assignmentTypes.length + 1,
      });
      if (res.success && res.data) {
        toast.success("Assignment type created");
        setAssignmentTypes((prev) => [...prev, res.data!]);
        setSelectedTypeId(res.data.id);
        setNewTypeName("");
        setShowNewType(false);
      } else {
        toast.error(res.error || "Failed to create assignment type");
      }
    } catch {
      toast.error("Failed to create assignment type");
    } finally {
      setSavingType(false);
    }
  };

  // ── Toggle course period selection ────────────────────────────
  const toggleCp = (cpId: string) => {
    setSelectedCpIds((prev) => {
      const next = new Set(prev);
      if (next.has(cpId)) next.delete(cpId);
      else next.add(cpId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCpIds.size === coursePeriods.length) {
      setSelectedCpIds(new Set());
    } else {
      setSelectedCpIds(new Set(coursePeriods.map((cp) => cp.id)));
    }
  };

  // ── Create Assignment ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!points || parseFloat(points) <= 0) {
      toast.error("Points must be greater than 0");
      return;
    }
    if (!selectedTypeId) {
      toast.error("Select an assignment type");
      return;
    }
    if (selectedCpIds.size === 0) {
      toast.error("Select at least one course period");
      return;
    }
    setCreating(true);
    try {
      const res = await gradesApi.massCreateAssignment({
        title: title.trim(),
        assignment_type_id: selectedTypeId,
        points: parseFloat(points),
        default_points: defaultPoints ? parseFloat(defaultPoints) : null,
        weight: weight ? parseFloat(weight) : null,
        description: description.trim() || null,
        assigned_date: assignedDate || null,
        due_date: dueDate || null,
        enable_submission: enableSubmission,
        course_period_ids: Array.from(selectedCpIds),
      });
      if (res.success) {
        const count = res.data?.created_count || selectedCpIds.size;
        toast.success(
          `Assignment created for ${count} course period${count !== 1 ? "s" : ""}`
        );
        // Reset form
        setTitle("");
        setPoints("");
        setDefaultPoints("");
        setWeight("");
        setDescription("");
        setDueDate("");
        setEnableSubmission(false);
        setSelectedCpIds(new Set());
      } else {
        toast.error(res.error || "Failed to create assignments");
      }
    } catch {
      toast.error("Failed to create assignments");
    } finally {
      setCreating(false);
    }
  };

  // ── Get MP name by id ─────────────────────────────────────────
  const getMpName = (mpId?: string | null) => {
    if (!mpId) return "—";
    const mp = markingPeriods.find((m) => m.id === mpId);
    return mp ? mp.title : "—";
  };

  // ── Get teacher name ──────────────────────────────────────────
  const getTeacherName = (cp: CoursePeriod) => {
    if (!cp.teacher) return "—";
    return `${cp.teacher.first_name || ""} ${cp.teacher.last_name || ""}`.trim() || "—";
  };

  // ── Get course title ──────────────────────────────────────────
  const getCourseTitle = (cp: CoursePeriod) =>
    cp.course?.title || "Unknown Course";

  const selectedType = assignmentTypes.find((t) => t.id === selectedTypeId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-[#57A3CC]" />
            New Assignment
          </h1>
          <p className="text-muted-foreground mt-2">
            Create an assignment across multiple course periods
            {selectedCampus && (
              <span className="ml-1 font-medium">
                — {selectedCampus.name}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleCreate}
          disabled={
            creating ||
            !title.trim() ||
            !points ||
            !selectedTypeId ||
            selectedCpIds.size === 0
          }
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Create Assignment for Selected Course Periods
        </Button>
      </div>

      {/* Assignment Form */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assignment title"
            />
          </div>

          {/* Assignment Type (display) */}
          <div className="space-y-1.5">
            <Label>Assignment Type</Label>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="text-sm px-3 py-1"
              >
                {selectedType?.title || "None selected"}
              </Badge>
            </div>
          </div>

          {/* Points row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="points">
                Points <span className="text-destructive">*</span>
              </Label>
              <Input
                id="points"
                type="number"
                min="0"
                step="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultPoints">Default Points</Label>
              <Input
                id="defaultPoints"
                type="number"
                min="0"
                step="1"
                value={defaultPoints}
                onChange={(e) => setDefaultPoints(e.target.value)}
                placeholder="—"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="1.00"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Assignment description or instructions..."
              className="resize-y"
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="assignedDate" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Assigned Date
              </Label>
              <Input
                id="assignedDate"
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Enable Submission */}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="enableSubmission"
              checked={enableSubmission}
              onCheckedChange={(v) => setEnableSubmission(v === true)}
            />
            <Label
              htmlFor="enableSubmission"
              className="cursor-pointer font-normal"
            >
              Enable Assignment Submission
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Bottom — Assignment Types + Course Periods */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Assignment Types sidebar */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {assignmentTypes.length} assignment type
                {assignmentTypes.length !== 1 ? "s" : ""} found
              </p>
              <button
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-[#0369a1] transition-colors"
                onClick={() => setShowNewType(!showNewType)}
                title="Add assignment type"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {showNewType && (
              <div className="flex gap-2">
                <Input
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Type name"
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateType()}
                />
                <Button
                  size="sm"
                  className="h-8 bg-[#0369a1] hover:bg-[#025d8c] text-white"
                  disabled={savingType || !newTypeName.trim()}
                  onClick={handleCreateType}
                >
                  {savingType ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            )}

            <Separator />

            {loadingTypes ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : assignmentTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No assignment types. Click + to create one.
              </p>
            ) : (
              <div className="space-y-1">
                {assignmentTypes.map((at) => (
                  <button
                    key={at.id}
                    onClick={() => setSelectedTypeId(at.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedTypeId === at.id
                        ? "bg-[#0369a1] text-white font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {at.title}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Course Periods table */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground mb-3">
              {coursePeriods.length} course period
              {coursePeriods.length !== 1 ? "s" : ""} found
            </p>

            {loadingCps ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : coursePeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No course periods found for this campus.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#0369a1] text-white">
                      <th className="w-10 py-3 px-2">
                        <Checkbox
                          checked={
                            coursePeriods.length > 0 &&
                            selectedCpIds.size === coursePeriods.length
                          }
                          onCheckedChange={toggleAll}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0369a1]"
                        />
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                        Course
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                        Period Days - Short Name - Teacher
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                        Marking Period
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursePeriods.map((cp, idx) => (
                      <tr
                        key={cp.id}
                        className={`border-b hover:bg-muted/30 cursor-pointer ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        } ${selectedCpIds.has(cp.id) ? "bg-blue-50/50" : ""}`}
                        onClick={() => toggleCp(cp.id)}
                      >
                        <td className="py-2.5 px-2">
                          <Checkbox
                            checked={selectedCpIds.has(cp.id)}
                            onCheckedChange={() => toggleCp(cp.id)}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-sm font-medium">
                          {getCourseTitle(cp)}
                        </td>
                        <td className="py-2.5 px-2 text-sm text-muted-foreground">
                          {cp.room || "—"} -{" "}
                          {cp.course?.short_name || "—"} -{" "}
                          {getTeacherName(cp)}
                        </td>
                        <td className="py-2.5 px-2 text-sm">
                          {getMpName(cp.marking_period_id)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedCpIds.size > 0 && (
              <p className="text-sm text-[#0369a1] font-medium mt-3">
                {selectedCpIds.size} course period
                {selectedCpIds.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
