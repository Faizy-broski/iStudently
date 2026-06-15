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
import type { GradebookConfig, GroupedMarkingPeriods, MarkingPeriodFull } from "@/lib/api/grades";
import { useTranslations } from "next-intl";

export default function GradebookConfigurationPage() {
  const t = useTranslations("school.grades_module.configuration");
  const tc = useTranslations("school.grades_module.common");
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Basic config state ────────────────────────────────────────
  const [assignmentSorting, setAssignmentSorting] =
    useState<GradebookConfig["assignment_sorting"]>("due_date");
  const [autoSaveFinalGrades, setAutoSaveFinalGrades] = useState(true);
  const [weightAssignmentTypes, setWeightAssignmentTypes] = useState(true);
  const [weightAssignments, setWeightAssignments] = useState(true);
  const [defaultAssignedDate, setDefaultAssignedDate] = useState(true);
  const [defaultDueDate, setDefaultDueDate] = useState(true);
  const [hideLeterGrades, setHideLetterGrades] = useState(false);
  const [hidePrevQuarters, setHidePrevQuarters] = useState(false);
  const [anomalousMax, setAnomalousMax] = useState("100");
  const [latency, setLatency] = useState("");

  // ── Eligibility ───────────────────────────────────────────────
  const [eligibilityCumulative, setEligibilityCumulative] = useState(false);

  // ── Final Grading Percentages ─────────────────────────────────
  const [groupedPeriods, setGroupedPeriods] = useState<GroupedMarkingPeriods | null>(null);
  // weights keyed by config key e.g. "SEM-{qtr_id}" or "FY-{mp_id}"
  const [mpWeights, setMpWeights] = useState<Record<string, string>>({});

  const mark = () => setDirty(true);

  // ── Load ──────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [configRes, periodsRes] = await Promise.all([
        gradesApi.getGradebookConfig(selectedCampus?.id),
        gradesApi.getGroupedMarkingPeriods(selectedCampus?.id),
      ]);

      if (configRes.success && configRes.data) {
        const c = configRes.data;
        setAssignmentSorting(c.assignment_sorting || "due_date");
        setAutoSaveFinalGrades(c.auto_save_final_grades ?? true);
        setWeightAssignmentTypes(c.weight_assignment_types ?? true);
        setWeightAssignments(c.weight_assignments ?? true);
        setDefaultAssignedDate(c.default_assigned_date ?? true);
        setDefaultDueDate(c.default_due_date ?? true);
        setAnomalousMax(String(c.anomalous_max ?? 100));
        setLatency(c.latency != null ? String(c.latency) : "");

        // Load extra flags from raw config (returned as extra keys)
        const raw = c as any;
        setHideLetterGrades(raw.LETTER_GRADE_ALL === "Y");
        setHidePrevQuarters(raw.HIDE_PREVIOUS_ASSIGNMENT_TYPES === "Y");
        setEligibilityCumulative(raw.ELIGIBILITY_CUMULITIVE === "Y");

        // Extract MP weight keys (SEM-* and FY-*)
        const weights: Record<string, string> = {};
        Object.entries(raw).forEach(([k, v]) => {
          if (k.startsWith("SEM-") || k.startsWith("FY-")) {
            weights[k] = String(v ?? "");
          }
        });
        setMpWeights(weights);
      }

      if (periodsRes.success && periodsRes.data) {
        setGroupedPeriods(periodsRes.data);
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
    // Validate all graded rows sum to 100
    if (groupedPeriods) {
      const gradedSems = groupedPeriods.SEM.filter((s) => s.does_grades);
      if (gradedSems.length > 0) {
        // All quarters across ALL semesters must collectively sum to 100%
        // (e.g. Q1 30% + Q2 30% + Q3 20% + Q4 20% = 100%, not each semester independently)
        const allSemKeys: string[] = [];
        for (const sem of gradedSems) {
          const qtrs = groupedPeriods.QTR.filter((q) => q.parent_id === sem.id);
          qtrs.forEach((q) => allSemKeys.push(`SEM-${q.id}`));
        }
        const semTotal = allSemKeys.reduce((sum, k) => sum + (parseFloat(mpWeights[k] || "0") || 0), 0);
        if (allSemKeys.length > 0 && Math.abs(semTotal - 100) > 0.01) {
          toast.error(t("total_error"));
          return;
        }
      }
      const fy = groupedPeriods.FY[0];
      if (fy?.does_grades) {
        let fyTotal = 0;
        for (const sem of groupedPeriods.SEM) {
          const qtrs = groupedPeriods.QTR.filter((q) => q.parent_id === sem.id);
          qtrs.forEach((q) => { fyTotal += parseFloat(mpWeights[`FY-${q.id}`] || "0") || 0; });
          if (sem.does_grades) fyTotal += parseFloat(mpWeights[`FY-${sem.id}`] || "0") || 0;
        }
        if (Math.abs(fyTotal - 100) > 0.01) {
          toast.error(`"${fy.title}" — ${t("total_error")}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // Build batch config array
      const configs: Array<{ key: string; value: string }> = [
        { key: "ASSIGNMENT_SORTING", value: assignmentSorting },
        { key: "AUTO_SAVE_FINAL_GRADES", value: autoSaveFinalGrades ? "Y" : "N" },
        { key: "WEIGHT", value: weightAssignmentTypes ? "Y" : "N" },
        { key: "WEIGHT_ASSIGNMENTS", value: weightAssignments ? "Y" : "N" },
        { key: "DEFAULT_ASSIGNED", value: defaultAssignedDate ? "Y" : "N" },
        { key: "DEFAULT_DUE", value: defaultDueDate ? "Y" : "N" },
        { key: "LETTER_GRADE_ALL", value: hideLeterGrades ? "Y" : "N" },
        { key: "HIDE_PREVIOUS_ASSIGNMENT_TYPES", value: hidePrevQuarters ? "Y" : "N" },
        { key: "ANOMALOUS_MAX", value: anomalousMax || "100" },
        { key: "ELIGIBILITY_CUMULITIVE", value: eligibilityCumulative ? "Y" : "N" },
        ...(latency ? [{ key: "LATENCY", value: latency }] : []),
        // MP weights
        ...Object.entries(mpWeights)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => ({ key: k, value: v })),
      ];

      const res = await gradesApi.saveBatchGradebookConfig(configs, selectedCampus?.id);
      if (res.success) {
        toast.success(t("config_saved"));
        setDirty(false);
      } else {
        toast.error(t("config_save_failed"));
      }
    } catch {
      toast.error(t("config_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const setWeight = (key: string, value: string) => {
    setMpWeights((prev) => ({ ...prev, [key]: value }));
    mark();
  };

  // ── Helpers ───────────────────────────────────────────────────
  const rowTotal = (keys: string[]) =>
    keys.reduce((sum, k) => sum + (parseFloat(mpWeights[k] || "0") || 0), 0);

  const TotalBadge = ({ keys }: { keys: string[] }) => {
    const total = rowTotal(keys);
    const ok = Math.abs(total - 100) < 0.01;
    return (
      <span className={`text-sm font-semibold ${ok ? "text-green-600" : "text-red-600"}`}>
        {ok ? t("total_ok") : `${t("total_label")} = ${total.toFixed(1)}% — ${t("total_error")}`}
      </span>
    );
  };

  const renderFinalGradingSection = () => {
    if (!groupedPeriods) return null;

    const fy = groupedPeriods.FY[0];
    const gradedSems = groupedPeriods.SEM.filter((s) => s.does_grades);
    const hasAny = gradedSems.length > 0 || fy?.does_grades;

    if (!hasAny) {
      return (
        <p className="text-sm text-muted-foreground italic">{t("no_graded_periods")}</p>
      );
    }

    // Compute all SEM quarter keys across ALL semesters for the global total badge
    const allSemKeys: string[] = [];
    for (const sem of gradedSems) {
      const qtrs = groupedPeriods.QTR.filter((q) => q.parent_id === sem.id);
      qtrs.forEach((q) => allSemKeys.push(`SEM-${q.id}`));
    }

    return (
      <div className="space-y-4">
        {/* All periods across all semesters — single combined section */}
        {gradedSems.length > 0 && (
          <div className="border rounded-md p-3 space-y-3">
            {/* Global total badge across ALL semesters */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-sm">
                {gradedSems.map((s) => s.title).join(" + ")}
              </span>
              {allSemKeys.length > 0 && <TotalBadge keys={allSemKeys} />}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("final_grading_help")}
            </p>
            {/* Render quarters grouped by semester label, but weights contribute to ONE 100% total */}
            {gradedSems.map((sem) => {
              const qtrs = groupedPeriods.QTR.filter((q) => q.parent_id === sem.id)
                .sort((a, b) => a.sort_order - b.sort_order);
              if (qtrs.length === 0) return null;
              return (
                <div key={sem.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {sem.title}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {qtrs.map((qtr) => (
                      <div key={qtr.id} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{qtr.title}</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={mpWeights[`SEM-${qtr.id}`] ?? ""}
                            onChange={(e) => setWeight(`SEM-${qtr.id}`, e.target.value)}
                            className="h-8 w-20 text-center"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Year row */}
        {fy?.does_grades && (() => {
          const fyKeys: string[] = [];
          const fyColumns: Array<{ key: string; mp: MarkingPeriodFull }> = [];

          for (const sem of groupedPeriods.SEM.sort((a, b) => a.sort_order - b.sort_order)) {
            const qtrs = groupedPeriods.QTR.filter((q) => q.parent_id === sem.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            qtrs.forEach((q) => {
              fyKeys.push(`FY-${q.id}`);
              fyColumns.push({ key: `FY-${q.id}`, mp: q });
            });
            if (sem.does_grades) {
              fyKeys.push(`FY-${sem.id}`);
              fyColumns.push({ key: `FY-${sem.id}`, mp: sem });
            }
          }

          return (
            <div className="border rounded-md p-3 space-y-3 border-blue-200 bg-blue-50/40">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-semibold text-sm">{fy.title}</span>
                {fyKeys.length > 0 && <TotalBadge keys={fyKeys} />}
              </div>
              <div className="flex flex-wrap gap-4">
                {fyColumns.map(({ key, mp }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {mp.title}
                      {mp.mp_type === "SEM" && (
                        <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">SEM</span>
                      )}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={mpWeights[key] ?? ""}
                        onChange={(e) => setWeight(key, e.target.value)}
                        className="h-8 w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")}
            {selectedCampus && (
              <span className="ml-1 font-medium">— {selectedCampus.name}</span>
            )}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {tc("save")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">

          {/* ── Assignments ─────────────────────────────────────── */}
          <fieldset className="border rounded-md p-4 space-y-4">
            <legend className="text-sm font-semibold px-2">{t("assignments_section")}</legend>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("sort_by")}</Label>
              <RadioGroup
                value={assignmentSorting}
                onValueChange={(v) => { setAssignmentSorting(v as GradebookConfig["assignment_sorting"]); mark(); }}
                className="flex flex-wrap gap-4"
              >
                {(["due_date", "assigned_date", "title", "points"] as const).map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`sort-${v}`} />
                    <Label htmlFor={`sort-${v}`} className="text-sm cursor-pointer">
                      {t(`sort_${v}` as any)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-3">
              {[
                { id: "auto-save", checked: autoSaveFinalGrades, set: setAutoSaveFinalGrades, label: t("auto_save_final") },
                { id: "weight-types", checked: weightAssignmentTypes, set: setWeightAssignmentTypes, label: t("weight_types") },
                { id: "weight-assignments", checked: weightAssignments, set: setWeightAssignments, label: t("weight_assignments") },
                { id: "default-assigned", checked: defaultAssignedDate, set: setDefaultAssignedDate, label: t("default_assigned_today") },
                { id: "default-due", checked: defaultDueDate, set: setDefaultDueDate, label: t("default_due_today") },
                { id: "hide-letter", checked: hideLeterGrades, set: setHideLetterGrades, label: t("hide_letter_grades") },
                { id: "hide-prev", checked: hidePrevQuarters, set: setHidePrevQuarters, label: t("hide_prev_quarters") },
              ].map(({ id, checked, set, label }) => (
                <div key={id} className="flex items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(c) => { set(c === true); mark(); }}
                  />
                  <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex flex-wrap gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="anomalous-max" className="text-sm font-medium">{t("anomalous_max")}</Label>
                <Input
                  id="anomalous-max"
                  type="number"
                  min={1}
                  max={99999}
                  value={anomalousMax}
                  onChange={(e) => { setAnomalousMax(e.target.value); mark(); }}
                  className="h-9 w-30"
                />
                <p className="text-xs text-muted-foreground">{t("anomalous_max_help")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="latency" className="text-sm font-medium">{t("latency")}</Label>
                <Input
                  id="latency"
                  type="number"
                  min={0}
                  max={9999}
                  value={latency}
                  onChange={(e) => { setLatency(e.target.value); mark(); }}
                  placeholder={t("latency_none")}
                  className="h-9 w-30"
                />
                <p className="text-xs text-muted-foreground">{t("latency_help")}</p>
              </div>
            </div>
          </fieldset>

          {/* ── Eligibility ─────────────────────────────────────── */}
          <fieldset className="border rounded-md p-4 space-y-3">
            <legend className="text-sm font-semibold px-2">{t("eligibility_section")}</legend>
            <div className="flex items-center gap-3">
              <Checkbox
                id="eligibility-cumulative"
                checked={eligibilityCumulative}
                onCheckedChange={(c) => { setEligibilityCumulative(c === true); mark(); }}
              />
              <Label htmlFor="eligibility-cumulative" className="text-sm cursor-pointer">
                {t("eligibility_cumulative")}
              </Label>
            </div>
          </fieldset>

          {/* ── Final Grading Percentages ────────────────────────── */}
          <fieldset className="border rounded-md p-4 space-y-4">
            <legend className="text-sm font-semibold px-2">{t("final_grading_section")}</legend>
            <p className="text-xs text-muted-foreground">{t("final_grading_help")}</p>
            {renderFinalGradingSection()}
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
