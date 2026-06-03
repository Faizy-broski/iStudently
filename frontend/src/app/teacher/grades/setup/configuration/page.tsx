"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { getMyCoursePeriods } from "@/lib/api/courses";
import { useTeacherGradebookConfig, type TeacherCPConfig } from "@/hooks/useTeacherGradebookConfig";

const SORT_OPTIONS: TeacherCPConfig["assignment_sorting"][] = ["due_date", "assigned_date", "title", "points"];

export default function TeacherGradebookConfigurationPage() {
  const { user } = useAuth();
  const [selectedCPId, setSelectedCPId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: coursePeriods = [], isLoading: cpsLoading } = useSWR(
    user ? ["teacher-gb-config-cps", user.id] : null,
    () => getMyCoursePeriods(),
    { revalidateOnFocus: false }
  );

  const { config, loading: configLoading, error: configError, saveConfig } = useTeacherGradebookConfig(
    selectedCPId || undefined
  );

  const [assignmentSorting, setAssignmentSorting] = useState<TeacherCPConfig["assignment_sorting"]>("due_date");
  const [weightAssignmentTypes, setWeightAssignmentTypes] = useState(true);
  const [weightAssignments, setWeightAssignments] = useState(true);
  const [defaultAssignedDate, setDefaultAssignedDate] = useState(true);
  const [defaultDueDate, setDefaultDueDate] = useState(true);
  const [anomalousMax, setAnomalousMax] = useState("100");
  const [latency, setLatency] = useState("");

  useEffect(() => {
    if (!config) return;
    setAssignmentSorting(config.assignment_sorting ?? "due_date");
    setWeightAssignmentTypes(config.weight_assignment_types ?? true);
    setWeightAssignments(config.weight_assignments ?? true);
    setDefaultAssignedDate(config.default_assigned_date ?? true);
    setDefaultDueDate(config.default_due_date ?? true);
    setAnomalousMax(String(config.anomalous_max ?? 100));
    setLatency(config.latency != null ? String(config.latency) : "");
    setDirty(false);
  }, [config]);

  const selectedCoursePeriod = useMemo(
    () => coursePeriods.find((cp) => cp.id === selectedCPId) ?? null,
    [coursePeriods, selectedCPId]
  );

  const configIsLoading = configLoading || cpsLoading;
  const saveDisabled = saving || !selectedCPId || !dirty;

  const handleSave = async () => {
    if (!selectedCPId) return;
    setSaving(true);
    try {
      await saveConfig({
        assignment_sorting: assignmentSorting,
        weight_assignment_types: weightAssignmentTypes,
        weight_assignments: weightAssignments,
        default_assigned_date: defaultAssignedDate,
        default_due_date: defaultDueDate,
        anomalous_max: parseInt(anomalousMax, 10) || 100,
        latency: latency ? parseInt(latency, 10) : null,
      });
      toast.success("Course period override saved");
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => setDirty(true);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Gradebook Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Override gradebook defaults for a specific course period.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveDisabled} className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Override
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Period Override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_240px] items-end">
            <div>
              <Label htmlFor="course-period-select" className="text-sm font-medium">
                Course Period
              </Label>
              <Select value={selectedCPId} onValueChange={(value) => setSelectedCPId(value)}>
                <SelectTrigger id="course-period-select" className="w-full">
                  <SelectValue placeholder="Select course period" />
                </SelectTrigger>
                <SelectContent>
                  {coursePeriods.length === 0 ? (
                    <SelectItem value="no-course-periods" disabled>
                      No course periods available
                    </SelectItem>
                  ) : (
                    coursePeriods.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.short_name || cp.title || "Course Period"}
                        {cp.section?.name ? ` — ${cp.section.name}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium">Selected:</p>
              <p className="mt-2 text-sm text-gray-700">
                {selectedCoursePeriod ? (
                  <>{selectedCoursePeriod.short_name || selectedCoursePeriod.title}</>
                ) : (
                  "Choose a course period to save an override"
                )}
              </p>
            </div>
          </div>

          {configError && (
            <p className="text-sm text-red-500">{configError}</p>
          )}

          <fieldset className="rounded-lg border border-gray-200 p-4 space-y-6">
            <legend className="text-sm font-semibold px-2">Gradebook Defaults</legend>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort Assignments By</Label>
                <RadioGroup
                  value={assignmentSorting}
                  onValueChange={(value) => {
                    setAssignmentSorting(value as TeacherCPConfig["assignment_sorting"]);
                    markDirty();
                  }}
                  className="grid grid-cols-2 gap-3"
                >
                  {SORT_OPTIONS.map((option) => (
                    <label key={option} className="inline-flex items-center gap-2 text-sm">
                      <RadioGroupItem value={option} id={`sort-${option}`} />
                      {option.replace("_", " ")}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="weight-types"
                    checked={weightAssignmentTypes}
                    onCheckedChange={(checked) => {
                      setWeightAssignmentTypes(checked === true);
                      markDirty();
                    }}
                  />
                  <Label htmlFor="weight-types" className="text-sm cursor-pointer">
                    Weight assignment types
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="weight-assignments"
                    checked={weightAssignments}
                    onCheckedChange={(checked) => {
                      setWeightAssignments(checked === true);
                      markDirty();
                    }}
                  />
                  <Label htmlFor="weight-assignments" className="text-sm cursor-pointer">
                    Weight assignments
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="default-assigned-date"
                    checked={defaultAssignedDate}
                    onCheckedChange={(checked) => {
                      setDefaultAssignedDate(checked === true);
                      markDirty();
                    }}
                  />
                  <Label htmlFor="default-assigned-date" className="text-sm cursor-pointer">
                    Default assigned date to today
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="default-due-date"
                    checked={defaultDueDate}
                    onCheckedChange={(checked) => {
                      setDefaultDueDate(checked === true);
                      markDirty();
                    }}
                  />
                  <Label htmlFor="default-due-date" className="text-sm cursor-pointer">
                    Default due date to today
                  </Label>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="anomalous-max" className="text-sm font-medium">
                    Anomalous max points
                  </Label>
                  <Input
                    id="anomalous-max"
                    type="number"
                    min={1}
                    max={99999}
                    value={anomalousMax}
                    onChange={(event) => {
                      setAnomalousMax(event.target.value);
                      markDirty();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Warn when assignment points exceed this value.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="latency" className="text-sm font-medium">
                    Latency (minutes)
                  </Label>
                  <Input
                    id="latency"
                    type="number"
                    min={0}
                    max={9999}
                    value={latency}
                    onChange={(event) => {
                      setLatency(event.target.value);
                      markDirty();
                    }}
                    placeholder="None"
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay before grade changes are visible to students.
                  </p>
                </div>
              </div>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {configIsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
