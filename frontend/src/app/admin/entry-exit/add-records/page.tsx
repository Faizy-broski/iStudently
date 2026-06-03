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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  DoorOpen,
  DoorClosed,
  Users,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getCheckpoints, createBulkRecords, searchStudents } from "@/lib/api/entry-exit";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { Checkpoint } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Local types ──────────────────────────────────────────────────────────────

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
  profiles?: {
    first_name?: string;
    last_name?: string;
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddRecordsPage() {
  const t = useTranslations("school.entry_exit.dashboard");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  // ── Form state ────────────────────────────────────────────────────────────
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointId, setCheckpointId] = useState("");
  const [recordType, setRecordType] = useState<"ENTRY" | "EXIT" | "">("");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTimeStr());
  const [unauthorized, setUnauthorized] = useState(false);
  const [comments, setComments] = useState("");

  // ── Student list state ────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // ── Academics hooks ───────────────────────────────────────────────────────
  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();

  const filteredSections = useMemo(() => {
    if (filterGrade === "all") return sections;
    return sections.filter((s) => s.grade_level_id === filterGrade && s.is_active);
  }, [sections, filterGrade]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    getCheckpoints(schoolId).then(setCheckpoints).catch(() => {});
  }, [schoolId]);

  const loadStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoadingStudents(true);
    try {
      const data = await searchStudents(schoolId, searchQuery || undefined) as StudentRecord[];
      setStudents(data);
      setSelected(new Set());
    } catch {
      toast.error(t("msg_error_load_students"));
    } finally {
      setLoadingStudents(false);
    }
  }, [schoolId, searchQuery, t]);

  useEffect(() => {
    const t = setTimeout(() => void loadStudents(), 300);
    return () => clearTimeout(t);
  }, [loadStudents]);

  // ── Filtered view ─────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter((s: StudentRecord) => {
      if (filterGrade !== "all") {
        const gradeMatch =
          s.grade_level_id === filterGrade || s.grade_level === filterGrade;
        if (!gradeMatch) return false;
      }
      if (filterSection !== "all") {
        const secMatch =
          s.section_id === filterSection || s.section === filterSection;
        if (!secMatch) return false;
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
        : new Set(filteredStudents.map((s: StudentRecord) => String(s.id ?? s.student_id ?? "")))
    );
  }

  const allSelected =
    filteredStudents.length > 0 && selected.size === filteredStudents.length;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!checkpointId) {
      toast.error(t("msg_error_checkpoint"));
      return;
    }
    if (!recordType) {
      toast.error(t("msg_error_type"));
      return;
    }
    if (selected.size === 0) {
      toast.error(t("msg_error_no_selection"));
      return;
    }

    setSubmitting(true);
    try {
      await createBulkRecords({
        school_id: schoolId,
        checkpoint_id: checkpointId,
        person_ids: [...selected],
        person_type: "STUDENT",
        record_type: recordType,
        description: comments
          ? `${unauthorized ? "[UNAUTHORIZED] " : ""}${comments}`
          : unauthorized
          ? "[UNAUTHORIZED]"
          : undefined,
      });

      toast.success(
        t("msg_record_added", { type: recordType, count: selected.size })
      );
      setSelected(new Set());
      setComments("");
      setUnauthorized(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || t("msg_record_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-semibold border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/40 uppercase tracking-wide"
            >
              {t("badge_module")}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{t("page_title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("page_subtitle")}
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0 || !checkpointId || !recordType}
          className="gap-2 shrink-0"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {t("btn_submit_bulk")}
        </Button>
      </div>

      {/* ── Add Records Form ────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            {t("card_details_title")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

            {/* Type */}
            <div className="space-y-2">
              <Label>
                {t("label_type")} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={recordType}
                onValueChange={(v) => setRecordType(v as "ENTRY" | "EXIT")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholder_record_type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">
                    <span className="flex items-center gap-2">
                      <DoorOpen className="h-3.5 w-3.5 text-emerald-600" />
                      {t("type_entry")}
                    </span>
                  </SelectItem>
                  <SelectItem value="EXIT">
                    <span className="flex items-center gap-2">
                      <DoorClosed className="h-3.5 w-3.5 text-orange-600" />
                      {t("type_exit")}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>{t("label_date")}</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label>{t("label_time")}</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {/* Unauthorized */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="unauthorized"
                checked={unauthorized}
                onCheckedChange={(v) => setUnauthorized(!!v)}
              />
              <Label htmlFor="unauthorized" className="cursor-pointer font-normal">
                {t("option_unauthorized")}
              </Label>
            </div>

            {/* Comments */}
            <div className="space-y-2 sm:col-span-3">
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
        </CardContent>
      </Card>

      {/* ── Student List ────────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            {/* Grade filter */}
            <Select
              value={filterGrade}
              onValueChange={(v) => {
                setFilterGrade(v);
                setFilterSection("all");
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("toolbar_all_grades")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toolbar_all_grades")}</SelectItem>
                {gradeLevels.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Section filter */}
            <Select
              value={filterSection}
              onValueChange={setFilterSection}
              disabled={filterGrade === "all"}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("toolbar_all_sections")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toolbar_all_sections")}</SelectItem>
                {filteredSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("toolbar_search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadStudents()}
              disabled={loadingStudents}
              title={t("toolbar_refresh")}
            >
              <RefreshCw className={`h-4 w-4 ${loadingStudents ? "animate-spin" : ""}`} />
            </Button>

            {/* Count + selection info */}
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {loadingStudents ? t("msg_loading") : t("stat_students_found", { count: filteredStudents.length })}
              </span>
              {selected.size > 0 && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-100 ml-1">
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
              {searchQuery && (
                <p className="text-sm text-muted-foreground/60">
                  {t("msg_clear_search")}
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label={t("common.selectAll")}
                    />
                  </TableHead>
                  <TableHead>{t("table_header_student")}</TableHead>
                  <TableHead>{t("table_header_adm_no")}</TableHead>
                  <TableHead>{t("table_header_grade")}</TableHead>
                  <TableHead>{t("table_header_section")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
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
                  const fullName = `${firstName} ${lastName}`.trim() || t("msg_unknown");
                  const admNo =
                    student.admission_number ||
                    student.student_number ||
                    "—";
                  const gradeName =
                    student.grade_name ||
                    student.class_name ||
                    student.grade_level ||
                    "—";
                  const sectionName =
                    student.section_name ||
                    student.section ||
                    "—";
                  const isSelected = selected.has(id);

                  return (
                    <TableRow
                      key={id}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/20"
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
                                ? "bg-[#022172]"
                                : "bg-slate-400 dark:bg-slate-600"
                            }`}
                          >
                            {initials(fullName)}
                          </div>
                          <span className="font-medium">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{admNo}</TableCell>
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
            <div className="flex items-center justify-between px-4 py-3 border-t bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {selected.size}
                </span>{" "}
                {t("stat_selected", { count: selected.size })}
              </p>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !checkpointId || !recordType}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : recordType === "ENTRY" ? (
                  <DoorOpen className="h-4 w-4" />
                ) : (
                  <DoorClosed className="h-4 w-4" />
                )}
                {t("btn_submit_bulk")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
