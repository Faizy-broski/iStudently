"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  getCheckpoints,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint,
  getAuthorizedTimes,
  setAuthorizedTimes,
} from "@/lib/api/entry-exit";
import { Checkpoint, CheckpointAuthorizedTime } from "@/types";
import { Plus, Pencil, Trash2, Clock, Building2, MapPin } from "lucide-react";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function CheckpointsPage() {
  const t = useTranslations("school.entry_exit.checkpoints");
  const commonT = useTranslations("common");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("both");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Times dialog
  const [timesDialogOpen, setTimesDialogOpen] = useState(false);
  const [timesCheckpointId, setTimesCheckpointId] = useState("");
  const [timesCheckpointName, setTimesCheckpointName] = useState("");
  const [authorizedTimes, setAuthorizedTimesState] = useState<
    { day_of_week: number; start_time: string; end_time: string }[]
  >([]);
  const [savingTimes, setSavingTimes] = useState(false);

  useEffect(() => {
    if (schoolId) loadCheckpoints();
  }, [schoolId]);

  async function loadCheckpoints() {
    try {
      setLoading(true);
      const data = await getCheckpoints(schoolId);
      setCheckpoints(data);
    } catch (err) {
      console.error("Failed to load checkpoints:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      if (editingId) {
        await updateCheckpoint(editingId, {
          name,
          mode: mode as any,
          description: description || undefined,
        });
      } else {
        await createCheckpoint({
          school_id: schoolId,
          name,
          mode: mode as any,
          description: description || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
      loadCheckpoints();
    } catch (err) {
      console.error("Failed to save checkpoint:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("msg_delete_confirm"))) return;
    try {
      await deleteCheckpoint(id);
      loadCheckpoints();
    } catch (err) {
      console.error("Failed to delete checkpoint:", err);
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await updateCheckpoint(id, { is_active: !isActive });
      loadCheckpoints();
    } catch (err) {
      console.error("Failed to toggle checkpoint:", err);
    }
  }

  function startEdit(cp: Checkpoint) {
    setEditingId(cp.id);
    setName(cp.name);
    setMode(cp.mode);
    setDescription(cp.description || "");
    setDialogOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setMode("both");
    setDescription("");
  }

  async function openTimesDialog(cp: Checkpoint) {
    setTimesCheckpointId(cp.id);
    setTimesCheckpointName(cp.name);
    try {
      const times = await getAuthorizedTimes(cp.id);
      setAuthorizedTimesState(
        times.map((t: CheckpointAuthorizedTime) => ({
          day_of_week: t.day_of_week,
          start_time: t.start_time,
          end_time: t.end_time,
        })),
      );
    } catch {
      setAuthorizedTimesState([]);
    }
    setTimesDialogOpen(true);
  }

  function addTimeSlot() {
    setAuthorizedTimesState([
      ...authorizedTimes,
      { day_of_week: 1, start_time: "07:00", end_time: "18:00" },
    ]);
  }

  function removeTimeSlot(index: number) {
    setAuthorizedTimesState(authorizedTimes.filter((_, i) => i !== index));
  }

  function updateTimeSlot(index: number, field: string, value: any) {
    const updated = [...authorizedTimes];
    (updated[index] as any)[field] =
      field === "day_of_week" ? parseInt(value) : value;
    setAuthorizedTimesState(updated);
  }

  async function handleSaveTimes() {
    try {
      setSavingTimes(true);
      await setAuthorizedTimes(timesCheckpointId, authorizedTimes);
      setTimesDialogOpen(false);
    } catch (err) {
      console.error("Failed to save times:", err);
    } finally {
      setSavingTimes(false);
    }
  }

  function getModeColor(mode: string) {
    switch (mode) {
      case "entry":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
      case "exit":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("page_title")}</h1>
          <p className="text-muted-foreground">
            {t("page_subtitle")}
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("btn_add_checkpoint")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? t("dialog_edit_checkpoint_title") : t("dialog_add_checkpoint_title")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("label_checkpoint_name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("placeholder_checkpoint_name")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("label_checkpoint_mode")}</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">{t("mode_entry_exit")}</SelectItem>
                    <SelectItem value="entry">{t("mode_entry_only")}</SelectItem>
                    <SelectItem value="exit">{t("mode_exit_only")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("label_description")}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("placeholder_checkpoint_description")}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={submitting || !name.trim()}
                className="w-full"
              >
                {submitting ? t("msg_loading") : editingId ? commonT("update") : commonT("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Checkpoints Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("msg_loading")}
        </div>
      ) : checkpoints.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("msg_no_data")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checkpoints.map((cp) => (
            <Card
              key={cp.id}
              className={`border-0 shadow-sm transition-opacity ${!cp.is_active ? "opacity-50" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{cp.name}</h3>
                      {cp.description && (
                        <p className="text-xs text-muted-foreground">
                          {cp.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={`${getModeColor(cp.mode)} hover:${getModeColor(cp.mode)}`}
                  >
                    {cp.mode === "both"
                      ? t("mode_entry_exit")
                      : cp.mode === "entry"
                        ? t("mode_entry_only")
                        : t("mode_exit_only")}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cp.is_active}
                      onCheckedChange={() =>
                        handleToggleActive(cp.id, cp.is_active)
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {cp.is_active ? t("status_active") : t("status_inactive")}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openTimesDialog(cp)}
                      title={t("tooltip_authorized_times")}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(cp)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cp.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Authorized Times Dialog */}
      <Dialog open={timesDialogOpen} onOpenChange={setTimesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialog_times_title")} – {timesCheckpointName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {authorizedTimes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("msg_no_times")}
              </p>
            ) : (
              authorizedTimes.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                >
                  <Select
                    value={String(slot.day_of_week)}
                    onValueChange={(v) => updateTimeSlot(i, "day_of_week", v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((day, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {t(`day_${day.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) =>
                      updateTimeSlot(i, "start_time", e.target.value)
                    }
                    className="w-28"
                  />
                  <span className="text-muted-foreground text-sm">{commonT("to")}</span>
                  <Input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) =>
                      updateTimeSlot(i, "end_time", e.target.value)
                    }
                    className="w-28"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTimeSlot(i)}
                    className="text-destructive shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={addTimeSlot} className="gap-1">
              <Plus className="h-3 w-3" />
              {t("btn_add_time_slot")}
            </Button>
            <Button onClick={handleSaveTimes} disabled={savingTimes}>
              {savingTimes ? t("msg_loading") : t("btn_save_times")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
