"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Moon,
  Search,
  Users,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  getCheckpoints,
  createEveningLeave,
  getEveningLeaves,
  deleteEveningLeave,
  searchStudents,
} from "@/lib/api/entry-exit";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { Checkpoint } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const DAY_LABELS = [
  { value: 1, key: "day_monday" },
  { value: 2, key: "day_tuesday" },
  { value: 3, key: "day_wednesday" },
  { value: 4, key: "day_thursday" },
  { value: 5, key: "day_friday" },
  { value: 6, key: "day_saturday" },
  { value: 0, key: "day_sunday" },
];

interface StudentRecord {
  id?: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  student_name?: string;
  admission_number?: string;
  student_number?: string;
  grade_level_id?: string;
  grade_level?: string;
  grade_name?: string;
  class_name?: string;
  section_id?: string;
  section?: string;
  section_name?: string;
  profiles?: { first_name?: string; last_name?: string };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MassEveningLeavesPage() {
  const t = useTranslations("school.entry_exit.mass_evening_leaves");
  const commonT = useTranslations("common");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  // ── Form state ────────────────────────────────────────────────────────────
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointId, setCheckpointId] = useState("");
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5]),
  );
  const [returnTime, setReturnTime] = useState("");
  const [comments, setComments] = useState("");

  // ── Student list state ────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();

  const filteredSections = useMemo(() => {
    if (filterGrade === "all") return sections;
    return sections.filter(
      (s) => s.grade_level_id === filterGrade && s.is_active,
    );
  }, [sections, filterGrade]);

  // ── Load checkpoints ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    getCheckpoints(schoolId).then(setCheckpoints).catch(() => {});
  }, [schoolId]);

  // ── Load students ─────────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoadingStudents(true);
    try {
      const data = (await searchStudents(
        schoolId,
        searchQuery || undefined,
      )) as StudentRecord[];
      setStudents(data);
      setSelected(new Set());
    } catch {
      toast.error(t("msg_error_load_students"));
    } finally {
      setLoadingStudents(false);
    }
  }, [schoolId, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => void loadStudents(), 300);
    return () => clearTimeout(t);
  }, [loadStudents]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter((s: StudentRecord) => {
      if (filterGrade !== "all") {
        if (
          s.grade_level_id !== filterGrade &&
          s.grade_level !== filterGrade
        )
          return false;
      }
      if (filterSection !== "all") {
        if (s.section_id !== filterSection && s.section !== filterSection)
          return false;
      }
      return true;
    });
  }, [students, filterGrade, filterSection]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filteredStudents.length
        ? new Set()
        : new Set(
            filteredStudents.map(
              (s: StudentRecord) => String(s.id ?? s.student_id ?? ""),
            ),
          ),
    );
  }

  const allSelected =
    filteredStudents.length > 0 &&
    selected.size === filteredStudents.length;

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!checkpointId) {
      toast.error(t("msg_error_no_checkpoint"));
      return;
    }
    if (!fromDate) {
      toast.error(t("msg_error_no_start_date"));
      return;
    }
    if (!toDate) {
      toast.error(t("msg_error_no_end_date"));
      return;
    }
    if (daysOfWeek.size === 0) {
      toast.error(t("msg_error_no_days"));
      return;
    }
    if (!returnTime) {
      toast.error(t("msg_error_no_return_time"));
      return;
    }
    if (selected.size === 0) {
      toast.error(t("msg_error_no_students"));
      return;
    }

    setSubmitting(true);
    try {
      const ids = [...selected];

      // 1. Optionally delete existing evening leaves for this checkpoint
      if (deleteExisting) {
        const existing = await getEveningLeaves({
          school_id: schoolId,
        });
        const toDelete = existing.filter(
          (el) =>
            ids.includes(el.student_id) &&
            (el.checkpoint_id === checkpointId || !el.checkpoint_id),
        );
        await Promise.all(toDelete.map((el) => deleteEveningLeave(el.id)));
      }

      // 2. Create new evening leaves in bulk
      await Promise.all(
        ids.map((studentId) =>
          createEveningLeave({
            school_id: schoolId,
            student_id: studentId,
            checkpoint_id: checkpointId,
            start_date: fromDate,
            end_date: toDate,
            days_of_week: [...daysOfWeek].sort(),
            authorized_return_time: returnTime,
            reason: comments || undefined,
          }),
        ),
      );

      toast.success(
        t("msg_success_added", { count: ids.length }),
      );
      setSelected(new Set());
      setComments("");
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    selected.size > 0 &&
    !!checkpointId &&
    !!fromDate &&
    !!toDate &&
    !!returnTime &&
    daysOfWeek.size > 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold border-violet-300 text-violet-700 bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:bg-violet-950/40 uppercase tracking-wide"
            >
              {t("badge_module")}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">
            {t("page_title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("page_subtitle")}
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2 shrink-0"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {t("btn_submit")}
        </Button>
      </div>

      {/* ── Evening Leave Form ──────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            Evening Leave Details
          </p>

          {/* Delete existing */}
          <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Checkbox
              id="deleteExisting"
              checked={deleteExisting}
              onCheckedChange={(v) => setDeleteExisting(!!v)}
            />
            <Label
              htmlFor="deleteExisting"
              className="cursor-pointer font-normal text-sm text-amber-800 dark:text-amber-300"
            >
              {t("label_delete_existing", { checkpoint: checkpoints.find(cp => cp.id === checkpointId)?.name || t("label_checkpoint") })}
            </Label>
            {deleteExisting && (
              <AlertTriangle className="h-4 w-4 text-amber-600 ml-auto shrink-0" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Checkpoint */}
            <div className="space-y-2">
              <Label>
                {t("label_checkpoint")} <span className="text-destructive">*</span>
              </Label>
              <Select value={checkpointId} onValueChange={setCheckpointId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholder_checkpoint")} />
                </SelectTrigger>
                <SelectContent>
                  {checkpoints.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      {t("msg_no_checkpoints")}
                    </SelectItem>
                  )}
                  {checkpoints
                    .filter((cp) => cp.is_active)
                    .map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* From date */}
            <div className="space-y-2">
              <Label>
                {t("label_from")} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To date */}
            <div className="space-y-2">
              <Label>
                {t("label_to")} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Return time */}
            <div className="space-y-2">
              <Label>
                {t("label_return_time")} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
              />
            </div>

            {/* Comments */}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("label_comments")}</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={t("placeholder_comments")}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          {/* Days of week */}
          <div className="mt-5">
            <Label className="mb-3 block">
              {t("label_days")} <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map(({ value, key }) => {
                const checked = daysOfWeek.has(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      checked
                        ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-violet-400 hover:text-violet-700"
                    }`}
                  >
                    {t(key)}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Student List ────────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <Select
              value={filterGrade}
              onValueChange={(v) => {
                setFilterGrade(v);
                setFilterSection("all");
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("toolbar_grade")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toolbar_grade")}</SelectItem>
                {gradeLevels.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterSection}
              onValueChange={setFilterSection}
              disabled={filterGrade === "all"}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("toolbar_section")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toolbar_section")}</SelectItem>
                {filteredSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("toolbar_search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadStudents()}
              disabled={loadingStudents}
              title={t("toolbar_refresh")}
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingStudents ? "animate-spin" : ""}`}
              />
            </Button>

            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {loadingStudents ? (
                  commonT("loading")
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {filteredStudents.length}
                    </span>{" "}
                    {t("stat_students_found", { count: filteredStudents.length })}
                  </>
                )}
              </span>
              {selected.size > 0 && (
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-100 ml-1">
                  {t("stat_selected", { count: selected.size })}
                </Badge>
              )}
            </div>
          </div>

          {/* Table */}
          {loadingStudents ? (
            <div className="flex items-center justify-center py-14 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("msg_loading_students")}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <Users className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">{t("msg_no_students")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>{t("table_col_student")}</TableHead>
                  <TableHead>{t("table_col_adm_no")}</TableHead>
                  <TableHead>{t("table_col_grade")}</TableHead>
                  <TableHead>{t("table_col_section")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student: StudentRecord) => {
                  const id = String(student.id ?? student.student_id ?? "");
                  const firstName =
                    student.first_name ||
                    student.profiles?.first_name ||
                    student.student_name?.split(" ")[0] ||
                    "";
                  const lastName =
                    student.last_name ||
                    student.profiles?.last_name ||
                    student.student_name?.split(" ").slice(1).join(" ") ||
                    "";
                  const fullName =
                    `${firstName} ${lastName}`.trim() || "Unknown";
                  const admNo =
                    student.admission_number || student.student_number || "—";
                  const gradeName =
                    student.grade_name ||
                    student.class_name ||
                    student.grade_level ||
                    "—";
                  const sectionName =
                    student.section_name || student.section || "—";
                  const isSelected = selected.has(id);

                  return (
                    <TableRow
                      key={id}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-violet-50 dark:bg-violet-950/20"
                          : "hover:bg-muted/40"
                      }`}
                      onClick={() => toggleOne(id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select ${fullName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 ${
                              isSelected
                                ? "bg-violet-600"
                                : "bg-slate-400 dark:bg-slate-600"
                            }`}
                          >
                            {initials(fullName)}
                          </div>
                          <span className="font-medium">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admNo}
                      </TableCell>
                      <TableCell>
                        {gradeName !== "—" ? (
                          <Badge
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {gradeName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {sectionName}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Bottom action bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-violet-50/60 dark:bg-violet-950/20">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {selected.size}
                </span>{" "}
                {t("stat_selected", { count: selected.size })}
              </p>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {t("btn_submit")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
