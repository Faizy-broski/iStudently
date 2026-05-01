"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Scale,
  Plus,
  Minus,
  Save,
  Settings2,
  Zap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import { useTranslations } from "next-intl";
import type { GradingScale, GradingScaleGrade } from "@/lib/api/grades";

// ── Row types ───────────────────────────────────────────────────
interface GradeRow extends GradingScaleGrade {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface ScaleRow extends GradingScale {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

export default function GradingScalesPage() {
  const t = useTranslations("school.grades_module.grading_scales");
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Scales (tabs) ─────────────────────────────────────────────
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [loadingScales, setLoadingScales] = useState(true);

  // ── Grades for active scale ───────────────────────────────────
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── New grade row fields ──────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newLetter, setNewLetter] = useState("");
  const [newGPA, setNewGPA] = useState("");
  const [newMinPct, setNewMinPct] = useState("");
  const [newMaxPct, setNewMaxPct] = useState("");
  const [newSort, setNewSort] = useState("");
  const [newBreakOff, setNewBreakOff] = useState("");
  const [newIsPassing, setNewIsPassing] = useState(true);

  // ── Generation (Grading Scale Generation feature) ────────────
  const [genScaleId, setGenScaleId] = useState<string>("");
  const [genMin, setGenMin] = useState("0");
  const [genMax, setGenMax] = useState("10");
  const [genStep, setGenStep] = useState("0.1");
  const [genDecimal, setGenDecimal] = useState<"." | ",">(".");
  const [generating, setGenerating] = useState(false);

  // ── Scale management ──────────────────────────────────────────
  const [scaleRows, setScaleRows] = useState<ScaleRow[]>([]);
  const [newScaleTitle, setNewScaleTitle] = useState("");
  const [newScaleSort, setNewScaleSort] = useState("");
  const [newScaleDefault, setNewScaleDefault] = useState(false);
  const [newScaleHrGpa, setNewScaleHrGpa] = useState("");
  const [newScaleHhrGpa, setNewScaleHhrGpa] = useState("");
  const [savingScales, setSavingScales] = useState(false);

  // ── Load scales ───────────────────────────────────────────────
  const loadScales = useCallback(async () => {
    if (!user) return;
    setLoadingScales(true);
    try {
      const res = await gradesApi.getGradingScales(selectedCampus?.id);
      if (res.success && res.data) {
        setScales(res.data);
        if (res.data.length > 0 && !activeTab) {
          setActiveTab(res.data[0].id);
        }
      }
    } catch {
      toast.error(t("toast_load_scales_failed"));
    } finally {
      setLoadingScales(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadScales();
  }, [loadScales]);

  // ── Load grades when tab changes ──────────────────────────────
  const loadGrades = useCallback(async () => {
    if (!user || !activeTab || activeTab === "manage") return;
    setLoadingRows(true);
    try {
      const res = await gradesApi.getGradingScaleGrades(activeTab);
      if (res.success && res.data) {
        setRows(res.data.map((g) => ({ ...g })));
      }
    } catch {
      toast.error(t("toast_load_grades_failed"));
    } finally {
      setLoadingRows(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  useEffect(() => {
    if (activeTab === "manage") {
      setScaleRows(scales.map((s) => ({ ...s })));
    }
  }, [activeTab, scales]);

  // ── Grade row helpers ─────────────────────────────────────────
  const updateRow = (
    idx: number,
    field: keyof GradeRow,
    value: string | number | boolean | null
  ) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, _dirty: true } : r
      )
    );
  };

  const markDeleteRow = (idx: number) => {
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
    if (!newTitle.trim()) {
      toast.error(t("title_required"));
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        grading_scale_id: activeTab,
        title: newTitle.trim(),
        letter_grade: newLetter.trim(),
        gpa_value: newGPA ? parseFloat(newGPA) : 0,
        min_percent: newMinPct ? parseFloat(newMinPct) : 0,
        max_percent: newMaxPct ? parseFloat(newMaxPct) : 100,
        sort_order: newSort ? parseInt(newSort) : 0,
        break_off: newBreakOff ? parseFloat(newBreakOff) : 0,
        is_passing: newIsPassing,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewTitle("");
    setNewLetter("");
    setNewGPA("");
    setNewMinPct("");
    setNewMaxPct("");
    setNewSort("");
    setNewBreakOff("");
    setNewIsPassing(true);
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    let errors = 0;
    try {
      for (const row of rows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteGradingScaleGrade(activeTab, row.id);
        if (!res.success) errors++;
      }
      for (const row of rows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createGradingScaleGrade(activeTab, {
          title: row.title,
          letter_grade: row.letter_grade,
          gpa_value: row.gpa_value,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          sort_order: row.sort_order,
          break_off: row.break_off,
          is_passing: row.is_passing,
        });
        if (!res.success) errors++;
      }
      for (const row of rows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateGradingScaleGrade(activeTab, row.id, {
          title: row.title,
          letter_grade: row.letter_grade,
          gpa_value: row.gpa_value,
          min_percent: row.min_percent,
          max_percent: row.max_percent,
          sort_order: row.sort_order,
          break_off: row.break_off,
          is_passing: row.is_passing,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success(t("toast_grades_saved"));
      else toast.error(t("toast_ops_failed", { count: errors }));
      await loadGrades();
    } catch {
      toast.error(t("toast_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  // ── Grading Scale Generation ─────────────────────────────────
  const handleGenerateScale = async () => {
    if (!genScaleId) { toast.error(t("toast_select_scale_generate")); return; }
    const min = parseFloat(genMin);
    const max = parseFloat(genMax);
    const step = parseFloat(genStep);
    if (isNaN(min) || isNaN(max) || min >= max) {
      toast.error(t("toast_max_gt_min")); return;
    }
    if (!window.confirm(
      t("confirm_generate_replace", { min: genMin, max: genMax, step: genStep })
    )) return;

    setGenerating(true);
    try {
      const res = await gradesApi.generateGradingScaleGrades(genScaleId, {
        grade_min: min, grade_max: max, grade_step: step, decimal_separator: genDecimal,
      });
      if (res.success) {
        toast.success(res.message || t("toast_generated_success"));
        // Reload grades if the generated scale is currently active
        if (activeTab === genScaleId) await loadGrades();
        await loadScales();
      } else {
        toast.error(res.error || t("toast_generation_failed"));
      }
    } catch {
      toast.error(t("toast_generation_failed"));
    } finally {
      setGenerating(false);
    }
  };

  // ── Scale row helpers ─────────────────────────────────────────
  const updateScaleRow = (
    idx: number,
    field: keyof ScaleRow,
    value: string | number | boolean | null
  ) => {
    setScaleRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, _dirty: true } : r
      )
    );
  };

  const markDeleteScale = (idx: number) => {
    const row = scaleRows[idx];
    if (!row.id || row._isNew) {
      setScaleRows((prev) => prev.filter((_, i) => i !== idx));
    } else {
      if (row.grades && row.grades.length > 0) {
        toast.error(
          t("toast_cannot_delete_scale_with_grades")
        );
        return;
      }
      setScaleRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, _deleted: true } : r))
      );
    }
  };

  const addScaleRow = () => {
    if (!newScaleTitle.trim()) {
      toast.error(t("title_required"));
      return;
    }
    setScaleRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        school_id: "",
        title: newScaleTitle.trim(),
        is_default: newScaleDefault,
        is_active: true,
        sort_order: newScaleSort ? parseInt(newScaleSort) : 0,
        hr_gpa_value: newScaleHrGpa ? parseFloat(newScaleHrGpa) : null,
        hhr_gpa_value: newScaleHhrGpa ? parseFloat(newScaleHhrGpa) : null,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewScaleTitle("");
    setNewScaleSort("");
    setNewScaleDefault(false);
    setNewScaleHrGpa("");
    setNewScaleHhrGpa("");
  };

  const handleSaveScales = async () => {
    setSavingScales(true);
    let errors = 0;
    try {
      for (const row of scaleRows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteGradingScale(row.id);
        if (!res.success) errors++;
      }
      for (const row of scaleRows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createGradingScale({
          title: row.title,
          is_default: row.is_default,
          is_active: row.is_active,
          sort_order: row.sort_order,
          hr_gpa_value: row.hr_gpa_value ?? null,
          hhr_gpa_value: row.hhr_gpa_value ?? null,
        });
        if (!res.success) errors++;
      }
      for (const row of scaleRows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateGradingScale(row.id, {
          title: row.title,
          is_default: row.is_default,
          is_active: row.is_active,
          sort_order: row.sort_order,
          hr_gpa_value: row.hr_gpa_value ?? null,
          hhr_gpa_value: row.hhr_gpa_value ?? null,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success(t("toast_scales_saved"));
      else toast.error(t("toast_ops_failed", { count: errors }));
      await loadScales();
    } catch {
      toast.error(t("toast_save_failed"));
    } finally {
      setSavingScales(false);
    }
  };

  const hasDirtyGrades = rows.some(
    (r) => r._dirty || r._deleted || r._isNew
  );
  const hasDirtyScales = scaleRows.some(
    (r) => r._dirty || r._deleted || r._isNew
  );
  const visibleRows = rows.filter((r) => !r._deleted);
  const visibleScaleRows = scaleRows.filter((r) => !r._deleted);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <Scale className="h-8 w-8 text-[#57A3CC]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("subtitle")}
          {selectedCampus && (
            <span className="ml-1 font-medium">
              — {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      {loadingScales ? (
        <Skeleton className="h-10 w-full" />
      ) : scales.length === 0 && activeTab !== "manage" ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>{t("no_scales")}</p>
            <Button
              onClick={() => setActiveTab("manage")}
              variant="outline"
              className="mt-3"
            >
              {t("create_scale")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="flex-wrap">
            {scales.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.title}
                {s.is_default && (
                  <span className="ml-1.5 text-[10px] uppercase bg-[#0369a1] text-white rounded px-1 py-0.5">
                    {t("default_badge")}
                  </span>
                )}
              </TabsTrigger>
            ))}
            <TabsTrigger value="manage">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              {t("manage")}
            </TabsTrigger>
          </TabsList>

          {/* ── Grades per scale ─────────────────────────── */}
          {scales.map((scale) => (
            <TabsContent key={scale.id} value={scale.id}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-[#0369a1] font-medium">
                      {t("grades_in_scale", { count: visibleRows.length, scale: scale.title })}
                    </p>
                    <Button
                      onClick={handleSaveGrades}
                      disabled={saving || !hasDirtyGrades}
                      className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                      size="sm"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {t("save")}
                    </Button>
                  </div>

                  {loadingRows ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
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
                              {t("th_title")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                              {t("th_letter")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                              {t("th_gpa")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                              {t("th_min_pct")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                              {t("th_max_pct")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-20">
                              {t("th_break_off")}
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-16">
                              {t("th_sort")}
                            </th>
                            <th className="text-center text-xs font-semibold uppercase tracking-wider py-3 px-2 w-16">
                              {t("th_pass")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, idx) => {
                            const actualIdx = rows.indexOf(row);
                            return (
                              <tr
                                key={row.id}
                                className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                                  }`}
                              >
                                <td className="py-2 px-1">
                                  <button
                                    onClick={() => markDeleteRow(actualIdx)}
                                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={row.title}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "title",
                                        e.target.value
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    value={row.letter_grade}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "letter_grade",
                                        e.target.value
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={row.gpa_value}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "gpa_value",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    value={row.min_percent}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "min_percent",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    value={row.max_percent}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "max_percent",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={row.break_off}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "break_off",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    value={row.sort_order}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "sort_order",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="h-8 text-sm"
                                  />
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <Checkbox
                                    checked={row.is_passing}
                                    onCheckedChange={(c) =>
                                      updateRow(
                                        actualIdx,
                                        "is_passing",
                                        c === true
                                      )
                                    }
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
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder={t("placeholder_title")}
                                className="h-8 text-sm"
                                onKeyDown={(e) =>
                                  e.key === "Enter" && addRow()
                                }
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                value={newLetter}
                                onChange={(e) => setNewLetter(e.target.value)}
                                placeholder={t("placeholder_letter")}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                step="0.1"
                                value={newGPA}
                                onChange={(e) => setNewGPA(e.target.value)}
                                placeholder={t("placeholder_gpa")}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={newMinPct}
                                onChange={(e) => setNewMinPct(e.target.value)}
                                placeholder={t("placeholder_min")}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={newMaxPct}
                                onChange={(e) => setNewMaxPct(e.target.value)}
                                placeholder={t("placeholder_max")}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                step="0.1"
                                value={newBreakOff}
                                onChange={(e) =>
                                  setNewBreakOff(e.target.value)
                                }
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={newSort}
                                onChange={(e) => setNewSort(e.target.value)}
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Checkbox
                                checked={newIsPassing}
                                onCheckedChange={(c) =>
                                  setNewIsPassing(c === true)
                                }
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleSaveGrades}
                      disabled={saving || !hasDirtyGrades}
                      className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                      size="sm"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {t("save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* ── Manage Scales tab ────────────────────────── */}
          <TabsContent value="manage">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold">{t("title")}</p>
                  <Button
                    onClick={handleSaveScales}
                    disabled={savingScales || !hasDirtyScales}
                    className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                    size="sm"
                  >
                    {savingScales ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t("save")}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="w-8" />
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2">
                          {t("scale_title")}
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-20">
                          {t("scale_sort")}
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-24">
                          {t("hr_gpa")}
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-24">
                          {t("hhr_gpa")}
                        </th>
                        <th className="text-center text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-20">
                          {t("scale_default")}
                        </th>
                        <th className="text-center text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-20">
                          {t("active")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleScaleRows.map((row) => {
                        const actualIdx = scaleRows.indexOf(row);
                        return (
                          <tr
                            key={row.id}
                            className="border-b hover:bg-muted/30"
                          >
                            <td className="py-2 px-1">
                              <button
                                onClick={() => markDeleteScale(actualIdx)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                value={row.title}
                                onChange={(e) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "title",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={row.sort_order}
                                onChange={(e) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "sort_order",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="99"
                                value={row.hr_gpa_value ?? ""}
                                onChange={(e) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "hr_gpa_value",
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )
                                }
                                placeholder="—"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="99"
                                value={row.hhr_gpa_value ?? ""}
                                onChange={(e) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "hhr_gpa_value",
                                    e.target.value ? parseFloat(e.target.value) : null
                                  )
                                }
                                placeholder="—"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Checkbox
                                checked={row.is_default}
                                onCheckedChange={(c) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "is_default",
                                    c === true
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Checkbox
                                checked={row.is_active}
                                onCheckedChange={(c) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "is_active",
                                    c === true
                                  )
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-b bg-muted/20">
                        <td className="py-2 px-1">
                          <button
                            onClick={addScaleRow}
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={newScaleTitle}
                            onChange={(e) =>
                              setNewScaleTitle(e.target.value)
                            }
                            placeholder={t("scale_title")}
                            className="h-8 text-sm"
                            onKeyDown={(e) =>
                              e.key === "Enter" && addScaleRow()
                            }
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            value={newScaleSort}
                            onChange={(e) =>
                              setNewScaleSort(e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="99"
                            value={newScaleHrGpa}
                            onChange={(e) => setNewScaleHrGpa(e.target.value)}
                            placeholder={t("hr_gpa")}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="99"
                            value={newScaleHhrGpa}
                            onChange={(e) => setNewScaleHhrGpa(e.target.value)}
                            placeholder={t("hhr_gpa")}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Checkbox
                            checked={newScaleDefault}
                            onCheckedChange={(c) =>
                              setNewScaleDefault(c === true)
                            }
                          />
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleSaveScales}
                    disabled={savingScales || !hasDirtyScales}
                    className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                    size="sm"
                  >
                    {savingScales ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {t("save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── Generate Scale ─────────────────────────────────────────────────── */}
      {/* Mirrors RosarioSIS Grading_Scale_Generation plugin: auto-fills a     */}
      {/* numeric scale (min–max–step) and replaces all existing grade entries. */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
              {t("generate_scale")}
            </h2>
          </div>
          <p className="text-xs text-amber-700">
            {t("generate_help")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Target scale */}
            <div className="lg:col-span-2 space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("scale")}
              </label>
              <Select value={genScaleId} onValueChange={setGenScaleId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("select_scale_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {scales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("min_grade")}
              </label>
              <input
                type="number" min="0" max="99" step="1"
                value={genMin}
                onChange={(e) => setGenMin(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              />
            </div>

            {/* Max */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("max_grade")}
              </label>
              <input
                type="number" min="1" max="100" step="1"
                value={genMax}
                onChange={(e) => setGenMax(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs"
              />
            </div>

            {/* Step */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("generate_step")}
              </label>
              <Select value={genStep} onValueChange={setGenStep}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "0.5", "0.25", "0.1", "0.05", "0.01"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Decimal separator */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("generate_decimal")}:
              </label>
              <Select value={genDecimal} onValueChange={(v) => setGenDecimal(v as "." | ",")}>
                <SelectTrigger className="h-8 w-20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">.</SelectItem>
                  <SelectItem value=",">,</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview count */}
            {genStep && genMin !== "" && genMax !== "" && parseFloat(genMax) > parseFloat(genMin) && (
              <span className="text-xs text-muted-foreground">
                {t("grades_preview_count", { count: Math.round((parseFloat(genMax) - parseFloat(genMin)) / parseFloat(genStep)) + 1 })}
              </span>
            )}

            <Button
              onClick={handleGenerateScale}
              disabled={generating || scales.length === 0 || !genScaleId}
              className="ml-auto bg-amber-600 hover:bg-amber-700 text-white gap-2"
              size="sm"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {t("generate")}
            </Button>
          </div>

          <p className="text-xs text-amber-600 font-medium">
            {t("generate_warning")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
