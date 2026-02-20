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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  MessageSquare,
  Plus,
  Minus,
  Save,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type {
  ReportCardCommentCategory,
  ReportCardComment,
} from "@/lib/api/grades";

// ── Row type for inline editing ─────────────────────────────────
interface CommentRow extends ReportCardComment {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

// ── Category Row for the "Scales" management tab ─────────────────
interface CategoryRow extends ReportCardCommentCategory {
  _dirty?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

export default function ReportCardCommentsPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Categories (tabs) ─────────────────────────────────────────
  const [categories, setCategories] = useState<ReportCardCommentCategory[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  const [loadingCats, setLoadingCats] = useState(true);

  // ── Comments for active tab ───────────────────────────────────
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── New comment row fields ────────────────────────────────────
  const [newTitle, setNewTitle] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");

  // ── Category management (in "Categories" tab) ─────────────────
  const [catRows, setCatRows] = useState<CategoryRow[]>([]);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");
  const [newCatSort, setNewCatSort] = useState("");
  const [savingCats, setSavingCats] = useState(false);

  // ── Load categories ───────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    if (!user) return;
    setLoadingCats(true);
    try {
      const res = await gradesApi.getReportCardCommentCategories(
        selectedCampus?.id
      );
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoadingCats(false);
    }
  }, [user, selectedCampus?.id]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ── Load comments when tab changes ────────────────────────────
  const loadComments = useCallback(async () => {
    if (!user || activeTab === "categories") return;
    setLoadingRows(true);
    try {
      const catId = activeTab === "general" ? "-1" : activeTab;
      const res = await gradesApi.getReportCardComments(
        catId,
        selectedCampus?.id
      );
      if (res.success && res.data) {
        setRows(res.data.map((c) => ({ ...c })));
      }
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setLoadingRows(false);
    }
  }, [user, activeTab, selectedCampus?.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // ── Sync catRows when entering categories tab ─────────────────
  useEffect(() => {
    if (activeTab === "categories") {
      setCatRows(categories.map((c) => ({ ...c })));
    }
  }, [activeTab, categories]);

  // ── Comment row helpers ───────────────────────────────────────
  const updateRow = (idx: number, field: keyof CommentRow, value: string | number | null) => {
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
        prev.map((r, i) =>
          i === idx ? { ...r, _deleted: true } : r
        )
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
        title: newTitle.trim(),
        sort_order: newSortOrder ? parseInt(newSortOrder) : null,
        category_id: activeTab === "general" ? null : activeTab,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewTitle("");
    setNewSortOrder("");
  };

  // ── Save comments ─────────────────────────────────────────────
  const handleSaveComments = async () => {
    setSaving(true);
    let errors = 0;
    try {
      for (const row of rows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteReportCardComment(row.id);
        if (!res.success) errors++;
      }
      for (const row of rows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createReportCardComment({
          title: row.title,
          sort_order: row.sort_order,
          category_id: activeTab === "general" ? undefined : activeTab,
        });
        if (!res.success) errors++;
      }
      for (const row of rows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateReportCardComment(row.id, {
          title: row.title,
          sort_order: row.sort_order,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("Comments saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadComments();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Category row helpers ──────────────────────────────────────
  const updateCatRow = (idx: number, field: keyof CategoryRow, value: string | number | null) => {
    setCatRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [field]: value, _dirty: true } : r
      )
    );
  };

  const markDeleteCat = (idx: number) => {
    const row = catRows[idx];
    if (!row.id || row._isNew) {
      setCatRows((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setCatRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, _deleted: true } : r
        )
      );
    }
  };

  const addCatRow = () => {
    if (!newCatTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setCatRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        title: newCatTitle.trim(),
        color: newCatColor,
        sort_order: newCatSort ? parseInt(newCatSort) : null,
        comment_count: 0,
        _isNew: true,
        _dirty: true,
      },
    ]);
    setNewCatTitle("");
    setNewCatColor("#3b82f6");
    setNewCatSort("");
  };

  const handleSaveCategories = async () => {
    setSavingCats(true);
    let errors = 0;
    try {
      for (const row of catRows.filter((r) => r._deleted && !r._isNew)) {
        const res = await gradesApi.deleteReportCardCommentCategory(row.id);
        if (!res.success) errors++;
      }
      for (const row of catRows.filter((r) => r._isNew && !r._deleted)) {
        const res = await gradesApi.createReportCardCommentCategory({
          title: row.title,
          color: row.color || undefined,
          sort_order: row.sort_order ?? undefined,
        });
        if (!res.success) errors++;
      }
      for (const row of catRows.filter(
        (r) => r._dirty && !r._isNew && !r._deleted
      )) {
        const res = await gradesApi.updateReportCardCommentCategory(row.id, {
          title: row.title,
          color: row.color,
          sort_order: row.sort_order,
        });
        if (!res.success) errors++;
      }
      if (errors === 0) toast.success("Categories saved");
      else toast.error(`${errors} operation(s) failed`);
      await loadCategories();
    } catch {
      toast.error("Save failed");
    } finally {
      setSavingCats(false);
    }
  };

  const hasDirtyComments = rows.some(
    (r) => r._dirty || r._deleted || r._isNew
  );
  const hasDirtyCats = catRows.some(
    (r) => r._dirty || r._deleted || r._isNew
  );
  const visibleRows = rows.filter((r) => !r._deleted);
  const visibleCatRows = catRows.filter((r) => !r._deleted);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-[#57A3CC]" />
          Report Card Comments
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage comment categories and comments for report cards
          {selectedCampus && (
            <span className="ml-1 font-medium">
              — {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {loadingCats ? (
            <TabsTrigger value="_loading" disabled>
              Loading…
            </TabsTrigger>
          ) : (
            categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.color && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                {cat.title}{" "}
                <span className="text-xs text-muted-foreground ml-1">
                  ({cat.comment_count})
                </span>
              </TabsTrigger>
            ))
          )}
          <TabsTrigger value="categories">
            <Palette className="h-3.5 w-3.5 mr-1" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* ── Comments tab content ─────────────────────── */}
        {["general", ...categories.map((c) => c.id)].map((tabVal) => (
          <TabsContent key={tabVal} value={tabVal}>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#0369a1] font-medium">
                    {visibleRows.length} comment
                    {visibleRows.length !== 1 ? "s" : ""}
                  </p>
                  <Button
                    onClick={handleSaveComments}
                    disabled={saving || !hasDirtyComments}
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
                            Sort Order
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row, idx) => {
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
                                  title="Delete"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                              </td>
                              <td className="py-2 px-2">
                                <Input
                                  value={row.title}
                                  onChange={(e) =>
                                    updateRow(actualIdx, "title", e.target.value)
                                  }
                                  className="h-8 text-sm"
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
                                  className="h-8 text-sm w-20"
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
                              title="Add"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              placeholder="Comment title"
                              className="h-8 text-sm"
                              onKeyDown={(e) =>
                                e.key === "Enter" && addRow()
                              }
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              value={newSortOrder}
                              onChange={(e) => setNewSortOrder(e.target.value)}
                              className="h-8 text-sm w-20"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleSaveComments}
                    disabled={saving || !hasDirtyComments}
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

        {/* ── Categories management tab ────────────────── */}
        <TabsContent value="categories">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Comment Categories</p>
                <Button
                  onClick={handleSaveCategories}
                  disabled={savingCats || !hasDirtyCats}
                  className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                  size="sm"
                >
                  {savingCats ? (
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
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-28">
                        Color
                      </th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#0369a1] py-3 px-2 w-28">
                        Sort Order
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCatRows.map((row, idx) => {
                      const actualIdx = catRows.indexOf(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="py-2 px-1">
                            <button
                              onClick={() => markDeleteCat(actualIdx)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              value={row.title}
                              onChange={(e) =>
                                updateCatRow(
                                  actualIdx,
                                  "title",
                                  e.target.value
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="color"
                              value={row.color || "#3b82f6"}
                              onChange={(e) =>
                                updateCatRow(
                                  actualIdx,
                                  "color",
                                  e.target.value
                                )
                              }
                              className="h-8 w-10 rounded border cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="number"
                              value={row.sort_order ?? ""}
                              onChange={(e) =>
                                updateCatRow(
                                  actualIdx,
                                  "sort_order",
                                  e.target.value
                                    ? parseInt(e.target.value)
                                    : null
                                )
                              }
                              className="h-8 text-sm w-20"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {/* Add row */}
                    <tr className="border-b bg-muted/20">
                      <td className="py-2 px-1">
                        <button
                          onClick={addCatRow}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          value={newCatTitle}
                          onChange={(e) => setNewCatTitle(e.target.value)}
                          placeholder="Category title"
                          className="h-8 text-sm"
                          onKeyDown={(e) =>
                            e.key === "Enter" && addCatRow()
                          }
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="color"
                          value={newCatColor}
                          onChange={(e) => setNewCatColor(e.target.value)}
                          className="h-8 w-10 rounded border cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={newCatSort}
                          onChange={(e) => setNewCatSort(e.target.value)}
                          className="h-8 text-sm w-20"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleSaveCategories}
                  disabled={savingCats || !hasDirtyCats}
                  className="bg-[#0369a1] hover:bg-[#025d8c] text-white gap-2"
                  size="sm"
                >
                  {savingCats ? (
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
    </div>
  );
}
