"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "@/lib/api/hostel";
import { customFieldsApi, CustomFieldDefinition } from "@/lib/api/custom-fields";
import { HostelBuilding } from "@/types";
import { Plus, Building2, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function BuildingsPage() {
  const t = useTranslations("admin.hostel.buildings");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";
  const campusId = profile?.campus_id;

  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<HostelBuilding | null>(
    null,
  );

  // Custom fields
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [floors, setFloors] = useState(1);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCustomFieldDefs = useCallback(async () => {
    const res = await customFieldsApi.getFieldDefinitions("hostel_building", campusId ?? undefined);
    if (res.success && res.data) {
      setCustomFieldDefs(
        [...res.data].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      );
    }
  }, [campusId]);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
    loadCustomFieldDefs();
  }, [schoolId, loadCustomFieldDefs]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getBuildings(schoolId);
      setBuildings(data);
    } catch (err) {
      console.error("Failed to load buildings:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setAddress("");
    setFloors(1);
    setDescription("");
    setCustomFieldValues({});
    setEditingBuilding(null);
  }

  function openEdit(b: HostelBuilding) {
    setEditingBuilding(b);
    setName(b.name);
    setAddress(b.address || "");
    setFloors(b.floors);
    setDescription(b.description || "");
    const saved: Record<string, string> = {};
    if (b.custom_fields) {
      Object.entries(b.custom_fields).forEach(([k, v]) => {
        saved[k] = String(v ?? "");
      });
    }
    setCustomFieldValues(saved);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name) return;
    // Validate required custom fields
    const missingRequired = customFieldDefs.filter(
      (def) => def.required && !customFieldValues[def.field_key]?.trim()
    );
    if (missingRequired.length > 0) {
      toast.error(`Please fill in required fields: ${missingRequired.map((d) => d.label).join(", ")}`);
      return;
    }
    try {
      setSubmitting(true);
      if (editingBuilding) {
        await updateBuilding(editingBuilding.id, schoolId, {
          campus_id: campusId,
          name,
          address: address || undefined,
          floors,
          description: description || undefined,
          custom_fields: customFieldValues,
        });
      } else {
        await createBuilding({
          school_id: schoolId,
          campus_id: campusId,
          name,
          address: address || undefined,
          floors,
          description: description || undefined,
          custom_fields: customFieldValues,
        });
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save building:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('msg_delete_confirm'))) return;
    try {
      await deleteBuilding(id, schoolId);
      loadData();
      toast.success(t('msg_save_success'));
    } catch (err) {
      console.error("Failed to delete building:", err);
      toast.error(t('msg_save_error'));
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('header_title')}</h1>
          <p className="text-muted-foreground">
            {t('header_subtitle')}
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
              {t('btn_add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBuilding ? t('dialog_edit_title') : t('dialog_add_title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t('label_name')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('placeholder_name')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('label_address')}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('placeholder_address')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('label_floors')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={floors}
                    onChange={(e) => setFloors(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('label_description')}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('placeholder_description')}
                />
              </div>

              {/* Custom Fields */}
              {customFieldDefs.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('section_additional_fields')}</p>
                  {customFieldDefs.map((def) => (
                    <div key={def.id} className="space-y-1">
                      <Label className="text-sm">
                        {def.label}{def.required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      {(def.type === "text" || def.type === "number" || def.type === "date") && (
                        <Input
                          type={def.type === "date" ? "date" : def.type === "number" ? "number" : "text"}
                          value={customFieldValues[def.field_key] ?? ""}
                          onChange={(e) =>
                            setCustomFieldValues((prev) => ({ ...prev, [def.field_key]: e.target.value }))
                          }
                        />
                      )}
                      {def.type === "long-text" && (
                        <Textarea
                          rows={3}
                          value={customFieldValues[def.field_key] ?? ""}
                          onChange={(e) =>
                            setCustomFieldValues((prev) => ({ ...prev, [def.field_key]: e.target.value }))
                          }
                        />
                      )}
                      {def.type === "checkbox" && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={customFieldValues[def.field_key] === "true"}
                            onCheckedChange={(c) =>
                              setCustomFieldValues((prev) => ({ ...prev, [def.field_key]: c ? "true" : "false" }))
                            }
                          />
                          <span className="text-sm text-muted-foreground">{def.label}</span>
                        </div>
                      )}
                      {(def.type === "select" || def.type === "multi-select") && (
                        <Select
                          value={customFieldValues[def.field_key] ?? ""}
                          onValueChange={(v) =>
                            setCustomFieldValues((prev) => ({ ...prev, [def.field_key]: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(def.options || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || !name}
                className="w-full"
              >
                {submitting
                  ? t('btn_saving')
                  : editingBuilding
                    ? t('btn_update')
                    : t('btn_create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('msg_loading')}
        </div>
      ) : buildings.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">{t('msg_no_data')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('msg_no_data_desc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => (
            <Card key={b.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{b.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(b)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {b.address && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    {b.address}
                  </div>
                )}
                <div className="flex gap-2">
                  <Badge variant="secondary">{b.floors} {t('unit_floors')}</Badge>
                  <Badge variant="outline">{b.room_count ?? 0} {t('unit_rooms')}</Badge>
                  {b.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {t('status_active')}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">{t('status_inactive')}</Badge>
                  )}
                </div>
                {b.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {b.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
