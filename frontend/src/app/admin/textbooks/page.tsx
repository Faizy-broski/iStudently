"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGradeLevels } from "@/hooks/useAcademics";
import { useTextbooks } from "@/hooks/useTextbooks";
import type { Textbook } from "@/lib/api/textbooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

export default function TextbookCatalogPage() {
  const t = useTranslations("textbooks.catalog");
  const { gradeLevels } = useGradeLevels();
  const { textbooks, loading, createTextbook, updateTextbook, deleteTextbook, restockTextbook } = useTextbooks();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Textbook | null>(null);
  const [form, setForm] = useState({ title: "", grade_level_id: "", subject: "", stock_quantity: "0" });
  const [saving, setSaving] = useState(false);

  const [restockTarget, setRestockTarget] = useState<Textbook | null>(null);
  const [restockAmount, setRestockAmount] = useState("");

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", grade_level_id: "", subject: "", stock_quantity: "0" });
    setDialogOpen(true);
  };

  const openEdit = (book: Textbook) => {
    setEditing(book);
    setForm({ title: book.title, grade_level_id: book.grade_level_id, subject: book.subject || "", stock_quantity: String(book.stock_quantity) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.grade_level_id) {
      toast.error(t("titleRequiredError"));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateTextbook(editing.id, {
          title: form.title.trim(),
          grade_level_id: form.grade_level_id,
          subject: form.subject.trim() || undefined,
        });
        toast.success(t("updateSuccess"));
      } else {
        await createTextbook({
          title: form.title.trim(),
          grade_level_id: form.grade_level_id,
          subject: form.subject.trim() || undefined,
          stock_quantity: Number(form.stock_quantity) || 0,
        });
        toast.success(t("createSuccess"));
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book: Textbook) => {
    if (!confirm(t("deleteConfirm", { title: book.title }))) return;
    try {
      await deleteTextbook(book.id);
      toast.success(t("deleteSuccess"));
    } catch (err: any) {
      toast.error(err?.message || t("deleteError"));
    }
  };

  const handleRestock = async () => {
    if (!restockTarget) return;
    const amount = Number(restockAmount);
    if (!amount) {
      toast.error(t("restockAmountRequired"));
      return;
    }
    try {
      await restockTextbook(restockTarget.id, amount);
      toast.success(t("restockSuccess"));
      setRestockTarget(null);
      setRestockAmount("");
    } catch (err: any) {
      toast.error(err?.message || t("restockError"));
    }
  };

  const gradeName = (id: string) => gradeLevels.find((g) => g.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/admin/textbooks/matrix" className="text-sm underline text-[#022172] dark:text-white">{t("deliveryMatrixLink")}</Link>
          <Link href="/admin/textbooks/dashboard" className="text-sm underline text-[#022172] dark:text-white">{t("missingBooksLink")}</Link>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-[#022172] text-white">
                <Plus className="h-4 w-4 mr-1" /> {t("addButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? t("dialogEditTitle") : t("dialogAddTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("labelTitle")}</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>{t("labelGradeLevel")}</Label>
                  <Select value={form.grade_level_id} onValueChange={(v) => setForm({ ...form, grade_level_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("selectGradePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("labelSubject")}</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                {!editing && (
                  <div>
                    <Label>{t("labelInitialStock")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.stock_quantity}
                      onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
                <Button onClick={handleSave} disabled={saving} className="bg-[#022172] text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : textbooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noTextbooks")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">{t("thTitle")}</th>
                    <th className="px-3 py-2 font-medium">{t("thGrade")}</th>
                    <th className="px-3 py-2 font-medium">{t("thSubject")}</th>
                    <th className="px-3 py-2 font-medium">{t("thStock")}</th>
                    <th className="px-3 py-2 font-medium">{t("thStatus")}</th>
                    <th className="px-3 py-2 font-medium text-right">{t("thActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {textbooks.map((book) => (
                    <tr key={book.id} className="border-b">
                      <td className="px-3 py-2">{book.title}</td>
                      <td className="px-3 py-2">{gradeName(book.grade_level_id)}</td>
                      <td className="px-3 py-2">{book.subject || "—"}</td>
                      <td className="px-3 py-2">{book.stock_quantity}</td>
                      <td className="px-3 py-2">
                        <Badge variant={book.is_active ? "default" : "secondary"}>
                          {book.is_active ? t("active") : t("inactive")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => setRestockTarget(book)} title={t("restockTitleAttr")}>
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(book)} title={t("editTitleAttr")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(book)} title={t("deleteTitleAttr")}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!restockTarget} onOpenChange={(open) => !open && setRestockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("restockDialogTitle", { title: restockTarget?.title || "" })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("restockLabel")}</Label>
            <Input type="number" value={restockAmount} onChange={(e) => setRestockAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("currentStock", { count: restockTarget?.stock_quantity ?? 0 })}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)}>{t("cancel")}</Button>
            <Button onClick={handleRestock} className="bg-[#022172] text-white">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
