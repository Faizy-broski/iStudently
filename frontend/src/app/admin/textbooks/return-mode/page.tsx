"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGradeLevels } from "@/hooks/useAcademics";
import { getSections, type Section } from "@/lib/api/academics";
import { useTextbookDeliveryMatrix } from "@/hooks/useTextbookDeliveryMatrix";
import { returnDelivery, bulkReturnDelivery } from "@/lib/api/textbook-deliveries";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * End-of-Year Return Mode (Feature 4). Reuses the same delivery matrix data
 * as the main matrix page, but only for cells that were actually delivered —
 * each shows a return_status + condition select instead of a checkbox.
 * No financial gate applies here — that only guards new deliveries.
 */
export default function TextbookReturnModePage() {
  const t = useTranslations("textbooks.returnMode");
  const { gradeLevels } = useGradeLevels();
  const [gradeId, setGradeId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const RETURN_STATUSES = [
    { value: "pending", label: t("statusPending") },
    { value: "returned", label: t("statusReturned") },
    { value: "lost", label: t("statusLost") },
  ];
  const CONDITIONS = [
    { value: "new", label: t("conditionNew") },
    { value: "good", label: t("conditionGood") },
    { value: "damaged", label: t("conditionDamaged") },
  ];

  useEffect(() => {
    if (!gradeId) {
      setSections([]);
      setSectionId("");
      return;
    }
    setSectionsLoading(true);
    getSections(gradeId)
      .then((res) => { if (res.success && res.data) setSections(res.data); })
      .finally(() => setSectionsLoading(false));
    setSectionId("");
  }, [gradeId]);

  const { matrix, loading, error, refresh } = useTextbookDeliveryMatrix({ sectionId: sectionId || undefined });

  const handleUpdate = async (deliveryId: string, return_status: string, condition?: string) => {
    setSavingId(deliveryId);
    try {
      const res = await returnDelivery(deliveryId, { return_status: return_status as any, condition: condition as any });
      if (!res.success) throw new Error(res.error || t("updateFailed"));
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || t("updateFailed"));
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkAllReturned = async () => {
    if (!matrix) return;
    const pendingIds = matrix.students
      .flatMap((s) => matrix.books.map((b) => s.deliveries[b.id]))
      .filter((d) => d && d.is_delivered && d.return_status === "pending")
      .map((d) => d!.id);

    if (pendingIds.length === 0) {
      toast.error(t("nothingPending"));
      return;
    }
    setBulkSaving(true);
    try {
      const res = await bulkReturnDelivery(pendingIds.map((id) => ({ id, return_status: "returned" as const })));
      if (!res.success) throw new Error(res.error || t("bulkUpdateFailed"));
      toast.success(t("markedReturned", { count: pendingIds.length }));
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || t("bulkUpdateFailed"));
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <Link href="/admin/textbooks/matrix" className="text-sm underline text-[#022172] dark:text-white">
          {t("backLink")}
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <div className="w-48">
            <Select value={gradeId} onValueChange={setGradeId}>
              <SelectTrigger><SelectValue placeholder={t("selectGradePlaceholder")} /></SelectTrigger>
              <SelectContent>
                {gradeLevels.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={sectionId} onValueChange={setSectionId} disabled={!gradeId || sectionsLoading}>
              <SelectTrigger><SelectValue placeholder={sectionsLoading ? t("loading") : t("selectSectionPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {matrix && (
            <Button onClick={handleMarkAllReturned} disabled={bulkSaving} variant="outline">
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t("markAllReturned")}
            </Button>
          )}
        </CardContent>
      </Card>

      {!sectionId && <p className="text-sm text-muted-foreground">{t("selectPrompt")}</p>}
      {sectionId && loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {sectionId && error && <p className="text-sm text-red-600">{error}</p>}

      {sectionId && matrix && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 bg-muted/50 z-10 px-3 py-2 text-left font-medium">{t("studentCol")}</th>
                {matrix.books.map((b) => (
                  <th key={b.id} className="px-3 py-2 text-center font-medium min-w-45">{b.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.students.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="sticky left-0 bg-inherit z-10 px-3 py-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.student_number}</div>
                  </td>
                  {matrix.books.map((b) => {
                    const delivery = s.deliveries[b.id];
                    if (!delivery || !delivery.is_delivered) {
                      return <td key={b.id} className="px-3 py-2 text-center text-xs text-muted-foreground">{t("notDelivered")}</td>;
                    }
                    const isSaving = savingId === delivery.id;
                    return (
                      <td key={b.id} className="px-3 py-2">
                        <div className="flex flex-col gap-1 items-center">
                          <Select
                            value={delivery.return_status}
                            disabled={isSaving}
                            onValueChange={(v) => handleUpdate(delivery.id, v, delivery.condition || undefined)}
                          >
                            <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {RETURN_STATUSES.map((rs) => <SelectItem key={rs.value} value={rs.value}>{rs.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select
                            value={delivery.condition || ""}
                            disabled={isSaving}
                            onValueChange={(v) => handleUpdate(delivery.id, delivery.return_status, v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder={t("conditionPlaceholder")} /></SelectTrigger>
                            <SelectContent>
                              {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
