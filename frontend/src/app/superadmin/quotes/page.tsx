"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Quote,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getAllQuotes,
  getQuoteSettings,
  createQuote,
  updateQuote,
  deleteQuote,
  reorderQuotes,
  updateQuoteSettings,
  type LoginQuote,
  type QuoteSettings,
} from "@/lib/api/quotes";

const EMPTY_FORM = { text_en: "", text_ar: "", is_active: true };

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<LoginQuote[]>([]);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LoginQuote | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([getAllQuotes(), getQuoteSettings()]);
      setQuotes(q);
      setSettings(s);
    } catch {
      toast.error("Failed to load quotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (q: LoginQuote) => {
    setEditing(q);
    setForm({ text_en: q.text_en, text_ar: q.text_ar, is_active: q.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.text_en.trim() || !form.text_ar.trim()) {
      toast.error("Both English and Arabic text are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateQuote(editing.id, form);
        setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
        toast.success("Quote updated");
      } else {
        const created = await createQuote({
          ...form,
          sort_order: quotes.length,
        });
        setQuotes((prev) => [...prev, created]);
        toast.success("Quote added");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteQuote(deleteId);
      setQuotes((prev) => prev.filter((q) => q.id !== deleteId));
      toast.success("Quote deleted");
    } catch {
      toast.error("Failed to delete quote");
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (q: LoginQuote) => {
    try {
      const updated = await updateQuote(q.id, { is_active: !q.is_active });
      setQuotes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      toast.error("Failed to update quote");
    }
  };

  const handleRotationChange = async (val: string) => {
    const rotation = val as "weekly" | "monthly";
    try {
      const updated = await updateQuoteSettings(rotation);
      setSettings(updated);
      toast.success("Rotation setting saved");
    } catch {
      toast.error("Failed to update settings");
    }
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...quotes];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setQuotes(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    try {
      await reorderQuotes(reordered.map((q) => q.id));
      toast.success("Order saved");
    } catch {
      toast.error("Failed to save order");
      load();
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Quote className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Login Page Quotes</h1>
            <p className="text-sm text-muted-foreground">
              Manage quotes displayed on the login page
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Quote
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Rotation Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Rotate quotes</Label>
            <Select
              value={settings?.rotation ?? "weekly"}
              onValueChange={handleRotationChange}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              A new quote will be shown every{" "}
              {settings?.rotation === "monthly" ? "month" : "week"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Quotes ({quotes.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Drag to reorder — the current quote is picked based on rotation period
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {quotes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Quote className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No quotes yet. Add your first quote.</p>
            </div>
          )}

          {quotes.map((q, index) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-start gap-3 p-3 rounded-lg border bg-card transition-all ${
                dragOverIndex === index
                  ? "border-primary bg-primary/5"
                  : "border-border"
              } ${dragIndex === index ? "opacity-40" : "opacity-100"}`}
            >
              <div className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    EN
                  </Badge>
                  <p className="text-sm truncate">{q.text_en}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    AR
                  </Badge>
                  <p className="text-sm truncate text-right font-arabic" dir="rtl">
                    {q.text_ar}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleToggleActive(q)}
                  title={q.is_active ? "Deactivate" : "Activate"}
                >
                  {q.is_active ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(q)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(q.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Quote" : "Add Quote"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>English Quote</Label>
              <Textarea
                placeholder="Enter quote in English..."
                value={form.text_en}
                onChange={(e) => setForm((f) => ({ ...f, text_en: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Arabic Quote</Label>
              <Textarea
                placeholder="أدخل الاقتباس بالعربية..."
                value={form.text_ar}
                onChange={(e) => setForm((f) => ({ ...f, text_ar: e.target.value }))}
                rows={3}
                dir="rtl"
                className="font-arabic text-right"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="is_active">Active (show on login page)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Add Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This quote will be permanently removed from the login page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
