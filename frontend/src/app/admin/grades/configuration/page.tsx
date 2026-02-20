"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { GradebookConfig } from "@/lib/api/grades";

export default function GradebookConfigurationPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Configuration state ───────────────────────────────────────
  const [assignmentSorting, setAssignmentSorting] =
    useState<GradebookConfig["assignment_sorting"]>("due_date");
  const [autoSaveFinalGrades, setAutoSaveFinalGrades] = useState(true);
  const [weightAssignmentTypes, setWeightAssignmentTypes] = useState(true);
  const [weightAssignments, setWeightAssignments] = useState(true);
  const [defaultAssignedDate, setDefaultAssignedDate] = useState(true);
  const [defaultDueDate, setDefaultDueDate] = useState(true);
  const [anomalousMax, setAnomalousMax] = useState("100");
  const [latency, setLatency] = useState("");

  // ── Load config ───────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await gradesApi.getGradebookConfig(selectedCampus?.id);
      if (res.success && res.data) {
        const c = res.data;
        setAssignmentSorting(c.assignment_sorting || "due_date");
        setAutoSaveFinalGrades(c.auto_save_final_grades ?? true);
        setWeightAssignmentTypes(c.weight_assignment_types ?? true);
        setWeightAssignments(c.weight_assignments ?? true);
        setDefaultAssignedDate(c.default_assigned_date ?? true);
        setDefaultDueDate(c.default_due_date ?? true);
        setAnomalousMax(String(c.anomalous_max ?? 100));
        setLatency(c.latency != null ? String(c.latency) : "");
      }
    } catch {
      toast.error("Failed to load configuration");
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await gradesApi.saveGradebookConfig(
        {
          assignment_sorting: assignmentSorting,
          auto_save_final_grades: autoSaveFinalGrades,
          weight_assignment_types: weightAssignmentTypes,
          weight_assignments: weightAssignments,
          default_assigned_date: defaultAssignedDate,
          default_due_date: defaultDueDate,
          anomalous_max: parseInt(anomalousMax) || 100,
          latency: latency ? parseInt(latency) : null,
        },
        selectedCampus?.id
      );
      if (res.success) {
        toast.success("Configuration saved");
        setDirty(false);
      } else {
        toast.error(res.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  // ── Dirty setter wrapper ──────────────────────────────────────
  const mark = () => setDirty(true);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <Settings className="h-8 w-8 text-[#57A3CC]" />
            Gradebook — Configuration
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure gradebook behavior and defaults
            {selectedCampus && (
              <span className="ml-1 font-medium">
                — {selectedCampus.name}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* ── Assignments section ─────────────────────── */}
          <fieldset className="border rounded-md p-4 space-y-4">
            <legend className="text-sm font-semibold px-2">Assignments</legend>

            {/* Sorting */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Sort Assignments By
              </Label>
              <RadioGroup
                value={assignmentSorting}
                onValueChange={(v) => {
                  setAssignmentSorting(
                    v as GradebookConfig["assignment_sorting"]
                  );
                  mark();
                }}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="due_date" id="sort-due" />
                  <Label htmlFor="sort-due" className="text-sm cursor-pointer">
                    Due Date
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="assigned_date" id="sort-assigned" />
                  <Label
                    htmlFor="sort-assigned"
                    className="text-sm cursor-pointer"
                  >
                    Assigned Date
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="title" id="sort-title" />
                  <Label
                    htmlFor="sort-title"
                    className="text-sm cursor-pointer"
                  >
                    Title
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="points" id="sort-points" />
                  <Label
                    htmlFor="sort-points"
                    className="text-sm cursor-pointer"
                  >
                    Points
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Boolean toggles */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="auto-save"
                  checked={autoSaveFinalGrades}
                  onCheckedChange={(c) => {
                    setAutoSaveFinalGrades(c === true);
                    mark();
                  }}
                />
                <Label htmlFor="auto-save" className="text-sm cursor-pointer">
                  Automatically calculate & save Final Grades using Gradebook
                  Grades
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="weight-types"
                  checked={weightAssignmentTypes}
                  onCheckedChange={(c) => {
                    setWeightAssignmentTypes(c === true);
                    mark();
                  }}
                />
                <Label
                  htmlFor="weight-types"
                  className="text-sm cursor-pointer"
                >
                  Weight Assignment Types
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="weight-assignments"
                  checked={weightAssignments}
                  onCheckedChange={(c) => {
                    setWeightAssignments(c === true);
                    mark();
                  }}
                />
                <Label
                  htmlFor="weight-assignments"
                  className="text-sm cursor-pointer"
                >
                  Weight Assignments
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="default-assigned"
                  checked={defaultAssignedDate}
                  onCheckedChange={(c) => {
                    setDefaultAssignedDate(c === true);
                    mark();
                  }}
                />
                <Label
                  htmlFor="default-assigned"
                  className="text-sm cursor-pointer"
                >
                  Default Assigned Date to today
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="default-due"
                  checked={defaultDueDate}
                  onCheckedChange={(c) => {
                    setDefaultDueDate(c === true);
                    mark();
                  }}
                />
                <Label
                  htmlFor="default-due"
                  className="text-sm cursor-pointer"
                >
                  Default Due Date to today
                </Label>
              </div>
            </div>

            <Separator />

            {/* Numeric fields */}
            <div className="flex flex-wrap gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="anomalous-max" className="text-sm font-medium">
                  Anomalous Max Points
                </Label>
                <Input
                  id="anomalous-max"
                  type="number"
                  min={1}
                  max={99999}
                  value={anomalousMax}
                  onChange={(e) => {
                    setAnomalousMax(e.target.value);
                    mark();
                  }}
                  className="h-9 w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Show warning when assignment points exceed this value
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="latency" className="text-sm font-medium">
                  Latency (minutes)
                </Label>
                <Input
                  id="latency"
                  type="number"
                  min={0}
                  max={9999}
                  value={latency}
                  onChange={(e) => {
                    setLatency(e.target.value);
                    mark();
                  }}
                  placeholder="None"
                  className="h-9 w-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Grade change delay before students/parents can see
                </p>
              </div>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
