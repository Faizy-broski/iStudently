"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useGradeLevels } from "@/hooks/useAcademics";
import { getSections, type Section } from "@/lib/api/academics";
import { useTextbookDeliveryMatrix } from "@/hooks/useTextbookDeliveryMatrix";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DeliveryCheckbox } from "./_components/DeliveryCheckbox";
import { CheckAllControls } from "./_components/CheckAllControls";
import { BarcodeScanInput } from "./_components/BarcodeScanInput";

export default function TextbookDeliveryMatrixPage() {
  const t = useTranslations("textbooks.matrix");
  const { profile } = useAuth();
  const canOverride = profile?.role === "admin" || profile?.role === "super_admin";

  const { gradeLevels } = useGradeLevels();
  const [gradeId, setGradeId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [sectionsLoading, setSectionsLoading] = useState(false);

  useEffect(() => {
    if (!gradeId) {
      setSections([]);
      setSectionId("");
      return;
    }
    setSectionsLoading(true);
    getSections(gradeId)
      .then((res) => {
        if (res.success && res.data) setSections(res.data);
      })
      .finally(() => setSectionsLoading(false));
    setSectionId("");
  }, [gradeId]);

  const { matrix, loading, error, isCellPending, toggleCell, toggleAll } = useTextbookDeliveryMatrix({
    sectionId: sectionId || undefined,
  });

  const handleCellToggle = async (studentId: string, bookId: string, next: boolean, override?: boolean) => {
    try {
      await toggleCell(studentId, bookId, next, { override });
    } catch (err: any) {
      toast.error(err?.message || t("updateFailed"));
    }
  };

  const handleRowCheckAll = async (studentId: string, next: boolean) => {
    if (!matrix) return;
    const items = matrix.books.map((b) => ({ studentId, bookId: b.id }));
    try {
      const { blockedCount } = await toggleAll(items, next);
      if (blockedCount > 0) toast.error(t("bulkBlockedBooks", { count: blockedCount }));
    } catch (err: any) {
      toast.error(err?.message || t("bulkUpdateFailed"));
    }
  };

  const handleColumnCheckAll = async (bookId: string, next: boolean) => {
    if (!matrix) return;
    const items = matrix.students.map((s) => ({ studentId: s.id, bookId }));
    try {
      const { blockedCount } = await toggleAll(items, next);
      if (blockedCount > 0) toast.error(t("bulkBlockedStudents", { count: blockedCount }));
    } catch (err: any) {
      toast.error(err?.message || t("bulkUpdateFailed"));
    }
  };

  const handleScan = async (code: string) => {
    if (!matrix) return;
    const student = matrix.students.find((s) => s.student_number === code);
    if (!student) {
      toast.error(t("scanNotFound", { code }));
      return;
    }
    await handleRowCheckAll(student.id, true);
    toast.success(t("scanSuccess", { name: student.name }));
  };

  return (
    <div className="space-y-6">
      <BarcodeScanInput onScan={handleScan} enabled={!!matrix} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/textbooks" className="underline text-[#022172] dark:text-white">{t("catalogLink")}</Link>
          <Link href="/admin/textbooks/return-mode" className="underline text-[#022172] dark:text-white">{t("returnModeLink")}</Link>
          <Link href="/admin/textbooks/dashboard" className="underline text-[#022172] dark:text-white">{t("missingBooksLink")}</Link>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <div className="w-48">
            <Select value={gradeId} onValueChange={setGradeId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectGradePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {gradeLevels.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={sectionId} onValueChange={setSectionId} disabled={!gradeId || sectionsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={sectionsLoading ? t("loading") : t("selectSectionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!sectionId && <p className="text-sm text-muted-foreground">{t("selectPrompt")}</p>}

      {sectionId && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {sectionId && error && <p className="text-sm text-red-600">{error}</p>}

      {sectionId && matrix && (
        matrix.books.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noBooksPart1")}{" "}
            <Link href="/admin/textbooks" className="underline">{t("noBooksLink")}</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 bg-muted/50 z-10 px-3 py-2 text-left font-medium">{t("studentCol")}</th>
                  <th className="px-3 py-2 text-center font-medium">{t("allCol")}</th>
                  {matrix.books.map((b) => {
                    const flags = matrix.students.map((s) => s.deliveries[b.id]?.is_delivered ?? false);
                    const allChecked = flags.length > 0 && flags.every(Boolean);
                    const someChecked = flags.some(Boolean);
                    return (
                      <th key={b.id} className="px-3 py-2 text-center font-medium min-w-[130px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{b.title}</span>
                          <span className="text-xs text-muted-foreground font-normal">{t("stockLabel", { count: b.stock_quantity })}</span>
                          <CheckAllControls
                            allChecked={allChecked}
                            someChecked={someChecked}
                            onToggle={(next) => handleColumnCheckAll(b.id, next)}
                            title={t("colCheckAllTitle", { title: b.title })}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrix.students.map((s) => {
                  const flags = matrix.books.map((b) => s.deliveries[b.id]?.is_delivered ?? false);
                  const allChecked = flags.length > 0 && flags.every(Boolean);
                  const someChecked = flags.some(Boolean);
                  return (
                    <tr key={s.id} className={`border-b ${s.has_overdue_payments ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                      <td className="sticky left-0 bg-inherit z-10 px-3 py-2 align-top">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.student_number}</div>
                        {s.has_overdue_payments && (
                          <Badge variant="destructive" className="mt-1 text-[10px]">{t("overdueBadge")}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-top">
                        <CheckAllControls
                          allChecked={allChecked}
                          someChecked={someChecked}
                          disabled={s.has_overdue_payments && !canOverride}
                          onToggle={(next) => handleRowCheckAll(s.id, next)}
                          title={t("rowCheckAllTitle", { name: s.name })}
                        />
                      </td>
                      {matrix.books.map((b) => (
                        <td key={b.id} className="px-3 py-2 text-center align-top">
                          <DeliveryCheckbox
                            delivery={s.deliveries[b.id]}
                            hasOverduePayments={s.has_overdue_payments}
                            isPending={isCellPending(s.id, b.id)}
                            canOverride={canOverride}
                            onToggle={(next, override) => handleCellToggle(s.id, b.id, next, override)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
