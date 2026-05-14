"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import {
  getRooms,
  getBuildings,
  createRoom,
  updateRoom,
  deleteRoom,
} from "@/lib/api/hostel";
import { customFieldsApi, CustomFieldDefinition } from "@/lib/api/custom-fields";
import { HostelRoom, HostelBuilding } from "@/types";
import { Plus, DoorOpen, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RoomsPage() {
  const t = useTranslations("admin.hostel.rooms");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";
  const campusId = profile?.campus_id;

  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);
  const [filterBuilding, setFilterBuilding] = useState("");

  // Custom fields
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Form
  const [buildingId, setBuildingId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState(1);
  const [capacity, setCapacity] = useState(1);
  const [roomType, setRoomType] = useState("standard");
  const [pricePerMonth, setPricePerMonth] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCustomFieldDefs = useCallback(async () => {
    const res = await customFieldsApi.getFieldDefinitions("hostel_room", campusId ?? undefined);
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
  }, [schoolId, filterBuilding, loadCustomFieldDefs]);

  async function loadData() {
    try {
      setLoading(true);
      const [roomsData, buildingsData] = await Promise.all([
        getRooms(schoolId, filterBuilding || undefined),
        getBuildings(schoolId),
      ]);
      setRooms(roomsData);
      setBuildings(buildingsData);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setBuildingId("");
    setRoomNumber("");
    setFloor(1);
    setCapacity(1);
    setRoomType("standard");
    setPricePerMonth(0);
    setDescription("");
    setCustomFieldValues({});
    setEditingRoom(null);
  }

  function openEdit(r: HostelRoom) {
    setEditingRoom(r);
    setBuildingId(r.building_id);
    setRoomNumber(r.room_number);
    setFloor(r.floor);
    setCapacity(r.capacity);
    setRoomType(r.room_type);
    setPricePerMonth(r.price_per_month);
    setDescription(r.description || "");
    // Populate saved custom field values
    const saved: Record<string, string> = {};
    if (r.custom_fields) {
      Object.entries(r.custom_fields).forEach(([k, v]) => {
        saved[k] = String(v ?? "");
      });
    }
    setCustomFieldValues(saved);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!roomNumber || !buildingId) return;
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
      if (editingRoom) {
        await updateRoom(editingRoom.id, schoolId, {
          campus_id: campusId,
          room_number: roomNumber,
          floor,
          capacity,
          room_type: roomType,
          price_per_month: pricePerMonth,
          description: description || undefined,
          custom_fields: customFieldValues,
        });
      } else {
        await createRoom({
          building_id: buildingId,
          school_id: schoolId,
          campus_id: campusId,
          room_number: roomNumber,
          floor,
          capacity,
          room_type: roomType,
          price_per_month: pricePerMonth,
          description: description || undefined,
          custom_fields: customFieldValues,
        });
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save room:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('msg_delete_confirm'))) return;
    try {
      await deleteRoom(id, schoolId);
      loadData();
    } catch (err) {
      console.error("Failed to delete room:", err);
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
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? t('dialog_edit_title') : t('dialog_add_title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {!editingRoom && (
                <div className="space-y-2">
                  <Label>{t('label_building')}</Label>
                  <Select value={buildingId} onValueChange={setBuildingId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('placeholder_building')} />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('label_room_number')}</Label>
                  <Input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder={t('placeholder_room_number')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('label_floor')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('label_capacity')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('label_type')}</Label>
                  <Select value={roomType} onValueChange={setRoomType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{t('type_standard')}</SelectItem>
                      <SelectItem value="premium">{t('type_premium')}</SelectItem>
                      <SelectItem value="suite">{t('type_suite')}</SelectItem>
                      <SelectItem value="shared">{t('type_shared')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('label_price')}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricePerMonth}
                  onChange={(e) => setPricePerMonth(Number(e.target.value))}
                />
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
                disabled={
                  submitting || !roomNumber || (!editingRoom && !buildingId)
                }
                className="w-full"
              >
                {submitting ? t('btn_saving') : editingRoom ? t('btn_update') : t('btn_create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <Label className="text-sm">{t('filter_label')}</Label>
        <Select
          value={filterBuilding || "ALL"}
          onValueChange={(v) => setFilterBuilding(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Buildings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('filter_all')}</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rooms Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('msg_loading')}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t('msg_no_data')}</h3>
              <p className="text-muted-foreground">
                {t('msg_no_data_desc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">{t('th_room')}</th>
                    <th className="text-left py-3 px-4 font-medium">
                      {t('th_building')}
                    </th>
                    <th className="text-left py-3 px-4 font-medium">{t('th_floor')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('th_type')}</th>
                    <th className="text-left py-3 px-4 font-medium">
                      {t('th_occupancy')}
                    </th>
                    <th className="text-left py-3 px-4 font-medium">{t('th_price')}</th>
                    <th className="text-left py-3 px-4 font-medium">{t('th_status')}</th>
                    <th className="text-right py-3 px-4 font-medium">
                      {t('th_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{r.room_number}</td>
                      <td className="py-3 px-4">{r.building_name || "—"}</td>
                      <td className="py-3 px-4">{r.floor}</td>
                      <td className="py-3 px-4 capitalize">{t(`type_${r.room_type}`)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.min(((r.occupancy || 0) / r.capacity) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {r.occupancy || 0}/{r.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.price_per_month > 0
                          ? `$${r.price_per_month.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {r.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {t('status_active')}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">{t('status_inactive')}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
