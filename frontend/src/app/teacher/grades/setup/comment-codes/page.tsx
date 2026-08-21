"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Tag, Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useTeacherCommentCodes } from "@/hooks/useTeacherCommentCodes";
import type { TeacherCommentCodeScale, TeacherCommentCode } from "@/hooks/useTeacherCommentCodes";
import { useAuth } from "@/context/AuthContext";

// ─── Scale section ────────────────────────────────────────────────────────────

function ScaleSection({
  scale,
  staffId,
  onEditScale,
  onDeleteScale,
  onAddCode,
  onEditCode,
  onDeleteCode,
}: {
  scale: TeacherCommentCodeScale;
  staffId: string;
  onEditScale: (scale: TeacherCommentCodeScale) => void;
  onDeleteScale: (id: string) => void;
  onAddCode: (scaleId: string) => void;
  onEditCode: (code: TeacherCommentCode) => void;
  onDeleteCode: (id: string) => void;
}) {
  const t = useTranslations("teacherPages.commentCodes");
  const [open, setOpen] = useState(true);
  const isOwned = scale.staff_id === staffId;
  const codes = (scale.codes ?? []).filter((c) => c.is_active !== false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white">
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <span className="font-medium text-gray-800">{scale.title}</span>
          {!isOwned && (
            <Badge className="bg-gray-100 text-gray-500 text-xs gap-1">
              <Lock className="h-3 w-3" /> {t("schoolWide")}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-1">{t("codeCount", { count: codes.length })}</span>
        </button>

        {isOwned && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onAddCode(scale.id)}>
              <Plus className="h-3.5 w-3.5" /> {t("addCode")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditScale(scale)}>
                  <Pencil className="h-4 w-4 mr-2" /> {t("editScale")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={() => onDeleteScale(scale.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> {t("deleteScale")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {open && codes.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-gray-200 bg-gray-100">
                <th className="text-left px-4 py-2">{t("code")}</th>
                <th className="text-left px-4 py-2">{t("title")}</th>
                <th className="text-left px-4 py-2">{t("description")}</th>
                {isOwned && <th className="w-12 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-white transition-colors">
                  <td className="px-4 py-2 font-mono text-blue-700 font-semibold">{code.short_name || "—"}</td>
                  <td className="px-4 py-2 text-gray-800">{code.title}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{code.comment || "—"}</td>
                  {isOwned && (
                    <td className="px-2 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditCode(code)}>
                            <Pencil className="h-4 w-4 mr-2" /> {t("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => onDeleteCode(code.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> {t("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && codes.length === 0 && isOwned && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">{t("noCodesYet")}</p>
          <Button size="sm" variant="outline" onClick={() => onAddCode(scale.id)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("addFirstCode")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherCommentCodesPage() {
  const t = useTranslations("teacherPages.commentCodes");
  const { profile } = useAuth();
  const staffId = profile?.staff_id ?? "";

  const { scales, loading, error, addScale, editScale, removeScale, addCode, editCode, removeCode } =
    useTeacherCommentCodes();

  // Scale dialog
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; editing?: TeacherCommentCodeScale }>({ open: false });
  const [scaleTitle, setScaleTitle] = useState("");
  const [scaleComment, setScaleComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Code dialog
  const [codeDialog, setCodeDialog] = useState<{ open: boolean; scaleId?: string; editing?: TeacherCommentCode }>({ open: false });
  const [codeTitle, setCodeTitle] = useState("");
  const [codeShortName, setCodeShortName] = useState("");
  const [codeComment, setCodeComment] = useState("");

  function openAddScale() {
    setScaleTitle("");
    setScaleComment("");
    setScaleDialog({ open: true });
  }

  function openEditScale(scale: TeacherCommentCodeScale) {
    setScaleTitle(scale.title);
    setScaleComment(scale.comment ?? "");
    setScaleDialog({ open: true, editing: scale });
  }

  async function handleSaveScale() {
    if (!scaleTitle.trim()) return;
    setSaving(true);
    try {
      if (scaleDialog.editing) {
        await editScale(scaleDialog.editing.id, { title: scaleTitle, comment: scaleComment || null });
        toast.success(t("scaleUpdated"));
      } else {
        await addScale(scaleTitle, scaleComment || undefined);
        toast.success(t("scaleCreated"));
      }
      setScaleDialog({ open: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("saveScaleFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteScale(id: string) {
    try {
      await removeScale(id);
      toast.success(t("scaleDeleted"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("deleteScaleFailed"));
    }
  }

  function openAddCode(scaleId: string) {
    setCodeTitle("");
    setCodeShortName("");
    setCodeComment("");
    setCodeDialog({ open: true, scaleId });
  }

  function openEditCode(code: TeacherCommentCode) {
    setCodeTitle(code.title);
    setCodeShortName(code.short_name ?? "");
    setCodeComment(code.comment ?? "");
    setCodeDialog({ open: true, editing: code });
  }

  async function handleSaveCode() {
    if (!codeTitle.trim()) return;
    setSaving(true);
    try {
      if (codeDialog.editing) {
        await editCode(codeDialog.editing.id, {
          title: codeTitle,
          short_name: codeShortName || null,
          comment: codeComment || null,
        });
        toast.success(t("codeUpdated"));
      } else if (codeDialog.scaleId) {
        await addCode(codeDialog.scaleId, {
          title: codeTitle,
          short_name: codeShortName || undefined,
          comment: codeComment || undefined,
        });
        toast.success(t("codeAdded"));
      }
      setCodeDialog({ open: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("saveCodeFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCode(id: string) {
    try {
      await removeCode(id);
      toast.success(t("codeDeleted"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("deleteCodeFailed"));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("pageTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("pageSubtitle")}
            </p>
          </div>
        </div>
        <Button onClick={openAddScale} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("newScale")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("commentCodeScales")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 text-center py-4">{error}</p>
          ) : scales.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{t("noScalesYet")}</p>
              <Button variant="outline" onClick={openAddScale}>
                <Plus className="h-4 w-4 mr-1" /> {t("createFirstScale")}
              </Button>
            </div>
          ) : (
            scales.map((scale) => (
              <ScaleSection
                key={scale.id}
                scale={scale}
                staffId={staffId}
                onEditScale={openEditScale}
                onDeleteScale={handleDeleteScale}
                onAddCode={openAddCode}
                onEditCode={openEditCode}
                onDeleteCode={handleDeleteCode}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Scale Dialog */}
      <Dialog open={scaleDialog.open} onOpenChange={(v) => setScaleDialog({ open: v })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{scaleDialog.editing ? t("editScale") : t("newCommentCodeScale")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t("title")}</Label>
              <Input
                value={scaleTitle}
                onChange={(e) => setScaleTitle(e.target.value)}
                placeholder={t("scaleTitlePlaceholder")}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>{t("descriptionOptional")}</Label>
              <Input
                value={scaleComment}
                onChange={(e) => setScaleComment(e.target.value)}
                placeholder={t("shortDescription")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleDialog({ open: false })}>{t("cancel")}</Button>
            <Button onClick={handleSaveScale} disabled={saving || !scaleTitle.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {scaleDialog.editing ? t("saveChanges") : t("createScale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Code Dialog */}
      <Dialog open={codeDialog.open} onOpenChange={(v) => setCodeDialog({ open: v })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{codeDialog.editing ? t("editCode") : t("addCommentCode")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{t("shortCode")}</Label>
                <Input
                  value={codeShortName}
                  onChange={(e) => setCodeShortName(e.target.value.toUpperCase())}
                  placeholder={t("shortCodePlaceholder")}
                  maxLength={10}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{t("title")}</Label>
                <Input
                  value={codeTitle}
                  onChange={(e) => setCodeTitle(e.target.value)}
                  placeholder={t("codeTitlePlaceholder")}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("descriptionOptional")}</Label>
              <Input
                value={codeComment}
                onChange={(e) => setCodeComment(e.target.value)}
                placeholder={t("expandedDescription")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeDialog({ open: false })}>{t("cancel")}</Button>
            <Button onClick={handleSaveCode} disabled={saving || !codeTitle.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {codeDialog.editing ? t("saveChanges") : t("addCode")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
