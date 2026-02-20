"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, History, Plus, Minus, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { HistoryMarkingPeriod, HistoryMPType } from "@/lib/api/grades";

// ── Row type for inline editing ─────────────────────────────────
interface MPRow extends HistoryMarkingPeriod {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

const MP_TYPES: { label: string; value: HistoryMPType }[] = [
  { label: "Year", value: "year" },
  { label: "Semester", value: "semester" },
  { label: "Quarter", value: "quarter" },
];

// Generate school year options (current - 20 years to current + 2)
function getSchoolYearOptions(): string[] {
  const now = new Date().getFullYear();
  const years: string[] = [];
  for (let y = now + 2; y >= now - 20; y--) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

export default function HistoryMarkingPeriodsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [rows, setRows] = useState<MPRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── New row fields ────────────────────────────────────────────
  const [newType, setNewType] = useState<HistoryMPType>("quarter");
  const [newName, setNewName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newPostEndDate, setNewPostEndDate] = useState("");
  const [newSchoolYear, setNewSchoolYear] = useState("");

  const schoolYears = getSchoolYearOptions();

  // ── Load data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await gradesApi.getHistoryMarkingPeriods(selectedCampus?.id);
      if (res.success && res.data) {
        setRows(res.data.map((mp) => ({ ...mp })));
      }
    } catch {
      toast.error("Failed to load history marking periods");
    } finally {
      setLoading(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Row helpers ───────────────────────────────────────────────
  const updateRow = (
    idx: number,
    field: keyof MPRow,
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
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        mp_type: newType,
        name: newName.trim(),
        short_name: newShortName.trim() || null,
        post_end_date: newPostEndDate || null,
        school_year: newSchoolYear || "",
        sort_order: null,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewName("");
    setNewShortName("");
    setNewPostEndDate("");
    setNewSchoolYear("");
  };

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    let errors = 0;
    try {
      // delete
      for (const row of rows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteHistoryMarkingPeriod(row.id);
        if (!res.success) errors++;
      }
      // create
      for (const row of rows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createHistoryMarkingPeriod({
          mp_type: row.mp_type,
          name: row.name,
          short_name: row.short_name || undefined,
          post_end_date: row.post_end_date || undefined,
          school_year: row.school_year || undefined,
        });
        if (!res.success) errors++;
      }
      // update
      for (const row of rows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateHistoryMarkingPeriod(row.id, {
          mp_type: row.mp_type,
          name: row.name,
          short_name: row.short_name,
          post_end_date: row.post_end_date,
          school_year: row.school_year,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("History marking periods saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadData();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = rows.some((r) => r._dirty || r._deleted || r._isNew);
  const visibleRows = rows.filter((r) => !r._deleted);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <History className="h-8 w-8 text-[#57A3CC]" />
            History Marking Periods
          </h1>
          <p className="text-muted-foreground mt-2">
            Define historical marking period records
            {selectedCampus && (
              <span className="ml-1 font-medium">
                — {selectedCampus.name}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasDirty}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
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
                    <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-32">
                      Type
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2">
                      Name
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-36">
                      Short Name
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-44">
                      Grade Post Date
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 px-2 w-40">
                      School Year
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
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="py-2 px-1">
                          <button
                            onClick={() => markDelete(actualIdx)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={row.mp_type}
                            onValueChange={(v) =>
                              updateRow(actualIdx, "mp_type", v as HistoryMPType)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MP_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              updateRow(actualIdx, "name", e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            value={row.short_name ?? ""}
                            onChange={(e) =>
                              updateRow(
                                actualIdx,
                                "short_name",
                                e.target.value || null
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="date"
                            value={row.post_end_date ?? ""}
                            onChange={(e) =>
                              updateRow(
                                actualIdx,
                                "post_end_date",
                                e.target.value || null
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={row.school_year ?? ""}
                            onValueChange={(v) =>
                              updateRow(actualIdx, "school_year", v || null)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {schoolYears.map((y) => (
                                <SelectItem key={y} value={y}>
                                  {y}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                      <Select
                        value={newType}
                        onValueChange={(v) =>
                          setNewType(v as HistoryMPType)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MP_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Period name"
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && addRow()}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        value={newShortName}
                        onChange={(e) => setNewShortName(e.target.value)}
                        placeholder="Short"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Input
                        type="date"
                        value={newPostEndDate}
                        onChange={(e) => setNewPostEndDate(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <Select
                        value={newSchoolYear}
                        onValueChange={setNewSchoolYear}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolYears.map((y) => (
                            <SelectItem key={y} value={y}>
                              {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
              {visibleRows.length} marking period
              {visibleRows.length !== 1 ? "s" : ""}
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
        </CardContent>
      </Card>
    </div>
  );
}
