"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Search,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import {
  getDisciplineReferrals,
  getDisciplineFields,
  deleteDisciplineReferral,
  type DisciplineReferral,
  type DisciplineField,
} from "@/lib/api/discipline";

// ---------------------------------------------------------------------------

function formatFieldValue(value: any, field?: DisciplineField): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (value === "Y") return "Y";
  if (value === "N") return "N";
  return String(value);
}

function studentName(r: DisciplineReferral): string {
  if (r.students) {
    // the API sometimes returns flattened `first_name`/`last_name`
    // and sometimes nests them under `profile`; support both shapes
    const first = r.students.first_name ?? r.students.profile?.first_name ?? "";
    const father = r.students.profile?.father_name ?? "";
    const last = r.students.last_name ?? r.students.profile?.last_name ?? "";
    const parts = [first];
    if (father) parts.push(father);
    if (last) parts.push(last);
    const name = parts.join(" ").trim();
    return name || r.students.student_number;
  }
  return r.student_id;
}

// ---------------------------------------------------------------------------

export default function DisciplineReferralsPage() {
  const { user } = useAuth();
  const campusCtx = useCampus();
  const t = useTranslations("discipline");
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId =
    user?.school_id || campusCtx?.selectedCampus?.parent_school_id || "";

  const [referrals, setReferrals] = useState<DisciplineReferral[]>([]);
  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail dialog
  const [viewReferral, setViewReferral] = useState<DisciplineReferral | null>(
    null,
  );
  const [deleting, setDeleting] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch fields once
  useEffect(() => {
    if (!schoolId) {
      setFields([]);
      return;
    }

    getDisciplineFields(schoolId)
      .then((res) => setFields(res.data ?? []))
      .catch(() => {
        // swallow any error, we'll show a toast so users know later if they try
        // to interact.  Without this the promise rejection bubbled to console.
      });
  }, [schoolId]);

  const fetchReferrals = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await getDisciplineReferrals({
        school_id: schoolId,
        campus_id: campusId,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: LIMIT,
      });
      setReferrals(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error(t("errors.loadReferrals"));
    } finally {
      setLoading(false);
    }
  }, [schoolId, campusId, startDate, endDate, page]);

  useEffect(() => {
    setPage(1);
  }, [campusId, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await deleteDisciplineReferral(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toasts.referralDeleted"));
      setReferrals((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => prev - 1);
      if (viewReferral?.id === id) setViewReferral(null);
    } catch {
      toast.error(t("errors.deleteReferral"));
    } finally {
      setDeleting(null);
    }
  }

  // Client-side filter by student name (search)
  const displayed = debouncedSearch
    ? referrals.filter(
        (r) =>
          studentName(r)
            .toLowerCase()
            .includes(debouncedSearch.toLowerCase()) ||
          (r.students?.student_number ?? "").includes(debouncedSearch),
      )
    : referrals;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertCircle className="h-7 w-7 text-destructive" />
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
              {campusId && ` · ${campusCtx?.selectedCampus?.name}`}
            </p>
          </div>
          <Link href="/admin/discipline/add-referral">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("add")}
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">{t("search_student")}</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm"
                    placeholder={t("search_placeholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("from_date")}</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("to_date")}</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="h-8"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
                {t("reset")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Referrals
              <Badge variant="secondary" className="ml-auto font-normal">
                {t("totalCount", { count: total })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                {t("loading")}
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {t("no_referrals")}
                {(startDate || endDate || debouncedSearch) &&
                  ` ${t("forSelectedFilters")}`}
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("student")}</TableHead>
                      <TableHead>{t("incident_date")}</TableHead>
                      <TableHead>{t("reporter")}</TableHead>
                      {fields.slice(0, 3).map((f) => (
                        <TableHead key={f.id}>{f.name}</TableHead>
                      ))}
                      <TableHead className="text-right">
                        {t("actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map((referral) => (
                      <TableRow key={referral.id} className="group">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {studentName(referral)}
                            </p>
                            {referral.students?.student_number && (
                              <p className="text-xs text-muted-foreground">
                                {referral.students.student_number}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(
                            referral.incident_date,
                          ).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {referral.reporter?.full_name ?? "-"}
                        </TableCell>
                        {fields.slice(0, 3).map((f) => (
                          <TableCell
                            key={f.id}
                            className="text-sm max-w-[160px] truncate"
                          >
                            {formatFieldValue(referral.field_values?.[f.id], f)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setViewReferral(referral)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(referral.id)}
                              disabled={deleting === referral.id}
                            >
                              {deleting === referral.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                <span className="text-muted-foreground">
                  {t("page_info", { page, totalPages, total })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={!!viewReferral}
        onOpenChange={(open) => {
          if (!open) setViewReferral(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("detail_title")}</DialogTitle>
          </DialogHeader>
          {viewReferral && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("student")}</p>
                  <p className="font-medium">{studentName(viewReferral)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("studentNumber")}</p>
                  <p className="font-medium">
                    {viewReferral.students?.student_number ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("incident_date")}</p>
                  <p className="font-medium">
                    {new Date(viewReferral.incident_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("reporter")}</p>
                  <p className="font-medium">
                    {viewReferral.reporter?.full_name ?? "-"}
                  </p>
                </div>
              </div>

              {fields.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("referralDetails")}
                  </p>
                  {fields.map((f) => {
                    const val = viewReferral.field_values?.[f.id];
                    if (val === null || val === undefined || val === "")
                      return null;
                    return (
                      <div key={f.id}>
                        <p className="text-xs text-muted-foreground">
                          {f.name}
                        </p>
                        <p className="text-sm">{formatFieldValue(val, f)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(viewReferral.id)}
                  disabled={deleting === viewReferral.id}
                >
                  {deleting === viewReferral.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {t("delete")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewReferral(null)}
                >
                  {t("close")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
