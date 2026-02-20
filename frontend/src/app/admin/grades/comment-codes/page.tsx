"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Tag,
  Plus,
  Minus,
  Save,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { CommentCodeScale, CommentCode } from "@/lib/api/grades";

// ── Row types ───────────────────────────────────────────────────
interface CodeRow extends CommentCode {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface ScaleRow extends CommentCodeScale {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

export default function CommentCodesPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Scales (tabs) ─────────────────────────────────────────────
  const [scales, setScales] = useState<CommentCodeScale[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [loadingScales, setLoadingScales] = useState(true);

  // ── Codes for active scale ────────────────────────────────────
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── New code fields ───────────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newSort, setNewSort] = useState("");

  // ── Scale management ──────────────────────────────────────────
  const [scaleRows, setScaleRows] = useState<ScaleRow[]>([]);
  const [newScaleTitle, setNewScaleTitle] = useState("");
  const [newScaleSort, setNewScaleSort] = useState("");
  const [savingScales, setSavingScales] = useState(false);

  // ── Load scales ───────────────────────────────────────────────
  const loadScales = useCallback(async () => {
    if (!user) return;
    setLoadingScales(true);
    try {
      const res = await gradesApi.getCommentCodeScales(selectedCampus?.id);
      if (res.success && res.data) {
        setScales(res.data);
        if (res.data.length > 0 && !activeTab) {
          setActiveTab(res.data[0].id);
        }
      }
    } catch {
      toast.error("Failed to load scales");
    } finally {
      setLoadingScales(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadScales();
  }, [loadScales]);

  // ── Load codes when tab changes ───────────────────────────────
  const loadCodes = useCallback(async () => {
    if (!user || !activeTab || activeTab === "scales") return;
    setLoadingRows(true);
    try {
      const res = await gradesApi.getCommentCodes(activeTab);
      if (res.success && res.data) {
        setRows(res.data.map((c) => ({ ...c })));
      }
    } catch {
      toast.error("Failed to load comment codes");
    } finally {
      setLoadingRows(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    if (activeTab === "scales") {
      setScaleRows(scales.map((s) => ({ ...s })));
    }
  }, [activeTab, scales]);

  // ── Code row helpers ──────────────────────────────────────────
  const updateRow = (idx: number, field: keyof CodeRow, value: string | number | null) => {
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
      toast.error("Title is required");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        scale_id: activeTab,
        title: newTitle.trim(),
        short_name: newShortName.trim() || null,
        comment: newComment.trim() || null,
        sort_order: newSort ? parseInt(newSort) : null,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewTitle("");
    setNewShortName("");
    setNewComment("");
    setNewSort("");
  };

  const handleSaveCodes = async () => {
    setSaving(true);
    let errors = 0;
    try {
      for (const row of rows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteCommentCode(row.id);
        if (!res.success) errors++;
      }
      for (const row of rows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createCommentCode({
          scale_id: activeTab,
          title: row.title,
          short_name: row.short_name || undefined,
          comment: row.comment || undefined,
          sort_order: row.sort_order ?? undefined,
        });
        if (!res.success) errors++;
      }
      for (const row of rows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateCommentCode(row.id, {
          title: row.title,
          short_name: row.short_name,
          comment: row.comment,
          sort_order: row.sort_order,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("Comment codes saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadCodes();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Scale row helpers ─────────────────────────────────────────
  const updateScaleRow = (idx: number, field: keyof ScaleRow, value: string | number | null) => {
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
      // Prevent deletion if scale might have codes
      // (would be caught by backend if it has codes)
      setScaleRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, _deleted: true } : r))
      );
    }
  };

  const addScaleRow = () => {
    if (!newScaleTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setScaleRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        title: newScaleTitle.trim(),
        sort_order: newScaleSort ? parseInt(newScaleSort) : null,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewScaleTitle("");
    setNewScaleSort("");
  };

  const handleSaveScales = async () => {
    setSavingScales(true);
    let errors = 0;
    try {
      for (const row of scaleRows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteCommentCodeScale(row.id);
        if (!res.success) errors++;
      }
      for (const row of scaleRows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createCommentCodeScale({
          title: row.title,
          sort_order: row.sort_order ?? undefined,
        });
        if (!res.success) errors++;
      }
      for (const row of scaleRows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateCommentCodeScale(row.id, {
          title: row.title,
          sort_order: row.sort_order,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("Scales saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadScales();
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingScales(false);
    }
  };

  const hasDirtyCodes = rows.some((r) => r._dirty || r._deleted || r._isNew);
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
          <Tag className="h-8 w-8 text-[#57A3CC]" />
          Comment Codes
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage comment code scales and their codes
          {selectedCampus && (
            <span className="ml-1 font-medium">
              — {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      {loadingScales ? (
        <Skeleton className="h-10 w-full" />
      ) : scales.length === 0 && activeTab !== "scales" ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>No comment code scales yet.</p>
            <Button
              onClick={() => setActiveTab("scales")}
              variant="outline"
              className="mt-3"
            >
              Manage Scales
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            {scales.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.title}
              </TabsTrigger>
            ))}
            <TabsTrigger value="scales">
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Scales
            </TabsTrigger>
          </TabsList>

          {/* ── Comment codes per scale ──────────────── */}
          {scales.map((scale) => (
            <TabsContent key={scale.id} value={scale.id}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-[#0369a1] font-medium">
                      {visibleRows.length} code
                      {visibleRows.length !== 1 ? "s" : ""} in &ldquo;
                      {scale.title}&rdquo;
                    </p>
                    <Button
                      onClick={handleSaveCodes}
                      disabled={saving || !hasDirtyCodes}
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

                  {loadingRows ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="w-8" />
                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2">
                              Title
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-28">
                              Short Name
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2">
                              Comment
                            </th>
                            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-24">
                              Sort
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => {
                            const actualIdx = rows.indexOf(row);
                            return (
                              <tr
                                key={row.id}
                                className="border-b hover:bg-muted/30"
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
                                  <Textarea
                                    value={row.comment ?? ""}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "comment",
                                        e.target.value || null
                                      )
                                    }
                                    className="min-h-[32px] text-sm resize-none"
                                    rows={1}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <Input
                                    type="number"
                                    value={row.sort_order ?? ""}
                                    onChange={(e) =>
                                      updateRow(
                                        actualIdx,
                                        "sort_order",
                                        e.target.value
                                          ? parseInt(e.target.value)
                                          : null
                                      )
                                    }
                                    className="h-8 text-sm w-16"
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
                                placeholder="Code title"
                                className="h-8 text-sm"
                                onKeyDown={(e) =>
                                  e.key === "Enter" && addRow()
                                }
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                value={newShortName}
                                onChange={(e) =>
                                  setNewShortName(e.target.value)
                                }
                                placeholder="Short"
                                className="h-8 text-sm"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Comment text…"
                                className="min-h-[32px] text-sm resize-none"
                                rows={1}
                              />
                            </td>
                            <td className="py-2 px-2">
                              <Input
                                type="number"
                                value={newSort}
                                onChange={(e) => setNewSort(e.target.value)}
                                className="h-8 text-sm w-16"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={handleSaveCodes}
                      disabled={saving || !hasDirtyCodes}
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

          {/* ── Scales management tab ─────────────────── */}
          <TabsContent value="scales">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold">Comment Code Scales</p>
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
                    Save
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="w-8" />
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2">
                          Title
                        </th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-24">
                          Sort
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
                                value={row.sort_order ?? ""}
                                onChange={(e) =>
                                  updateScaleRow(
                                    actualIdx,
                                    "sort_order",
                                    e.target.value
                                      ? parseInt(e.target.value)
                                      : null
                                  )
                                }
                                className="h-8 text-sm w-16"
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
                            placeholder="Scale title"
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
                            className="h-8 text-sm w-16"
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
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
