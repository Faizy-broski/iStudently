"use client";

import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { customFieldsApi, CustomFieldDefinition, CustomFieldType } from "@/lib/api/custom-fields";

type HostelEntityType = "hostel_room" | "hostel_building";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "select", label: "Pull-Down" },
  { value: "multi-select", label: "Select Multiple from Options" },
  { value: "text", label: "Text" },
  { value: "long-text", label: "Long Text" },
  { value: "checkbox", label: "Checkbox" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "file", label: "Files" },
];

const CATEGORY_ID = "general";
const CATEGORY_NAME = "General";

interface FieldRow {
  id: string;
  isNew: boolean;
  label: string;
  type: CustomFieldType;
  options: string; // newline-separated
  defaultValue: string;
  required: boolean;
  sort_order: number;
}

function hasOptions(type: CustomFieldType) {
  return type === "select" || type === "multi-select";
}

export default function HostelFieldsPage() {
  const { profile } = useAuth();
  const campusId = profile?.campus_id;
  const [entityType, setEntityType] = useState<HostelEntityType>("hostel_room");
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ---- new field form state ----
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("text");
  const [newOptions, setNewOptions] = useState("");
  const [newDefault, setNewDefault] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [newSortOrder, setNewSortOrder] = useState("");

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customFieldsApi.getFieldDefinitions(entityType, campusId);
      if (res.success && res.data) {
        const rows: FieldRow[] = res.data
          .sort((a: CustomFieldDefinition, b: CustomFieldDefinition) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((f: CustomFieldDefinition) => ({
            id: f.id,
            isNew: false,
            label: f.label,
            type: f.type,
            options: (f.options || []).join("\n"),
            defaultValue: "",
            required: f.required,
            sort_order: f.sort_order,
          }));
        setFields(rows);
      } else {
        setFields([]);
      }
    } catch {
      toast.error("Failed to load fields");
    } finally {
      setLoading(false);
    }
  }, [entityType, campusId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Reset form when entity type changes
  useEffect(() => {
    setNewLabel("");
    setNewType("text");
    setNewOptions("");
    setNewDefault("");
    setNewRequired(false);
    setNewSortOrder("");
  }, [entityType]);

  function addFieldRow() {
    if (!newLabel.trim()) {
      toast.error("Field name is required");
      return;
    }
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order), 0);
    const sortOrder = newSortOrder ? parseInt(newSortOrder) : maxOrder + 1;

    const row: FieldRow = {
      id: `new-${Date.now()}`,
      isNew: true,
      label: newLabel.trim(),
      type: newType,
      options: newOptions,
      defaultValue: newDefault,
      required: newRequired,
      sort_order: sortOrder,
    };

    setFields((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order));
    setNewLabel("");
    setNewType("text");
    setNewOptions("");
    setNewDefault("");
    setNewRequired(false);
    setNewSortOrder("");
    toast.success("Field added — click Save to persist");
  }

  function updateRow(id: string, patch: Partial<FieldRow>) {
    setFields((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setFields((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const existing = await customFieldsApi.getFieldDefinitions(entityType, campusId);
      const existingIds = new Set((existing.data || []).map((f: CustomFieldDefinition) => f.id));
      const currentIds = new Set<string>();

      for (const row of fields) {
        const optionsArr = row.options
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

        if (row.isNew || row.id.startsWith("new-")) {
          await customFieldsApi.createFieldDefinition(
            {
              entity_type: entityType,
              category_id: CATEGORY_ID,
              category_name: CATEGORY_NAME,
              label: row.label,
              type: row.type,
              options: optionsArr,
              required: row.required,
              sort_order: row.sort_order,
            },
            campusId
          );
        } else {
          currentIds.add(row.id);
          if (existingIds.has(row.id)) {
            await customFieldsApi.updateFieldDefinition(row.id, {
              label: row.label,
              type: row.type,
              options: optionsArr,
              required: row.required,
              sort_order: row.sort_order,
            });
          }
        }
      }

      // Delete removed fields
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          await customFieldsApi.deleteFieldDefinition(id);
        }
      }

      toast.success("Fields saved successfully");
      await loadFields();
    } catch {
      toast.error("Failed to save fields");
    } finally {
      setSaving(false);
    }
  }

  const entityLabel = entityType === "hostel_room" ? "Room" : "Building";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hostel {entityLabel} Fields</h1>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-700 hover:bg-blue-800 text-white"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Entity type toggle */}
      <Select
        value={entityType}
        onValueChange={(v) => setEntityType(v as HostelEntityType)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hostel_room">Room Fields</SelectItem>
          <SelectItem value="hostel_building">Building Fields</SelectItem>
        </SelectContent>
      </Select>

      {/* New field form */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            New {entityLabel} Field
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Field Name */}
            <div className="space-y-1">
              <Label className="text-xs text-red-600 font-semibold">Field Name *</Label>
              <Input
                placeholder={`e.g. ${entityType === "hostel_room" ? "Room Type" : "Wing / Block"}`}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Type</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as CustomFieldType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options (only for select types) */}
          {hasOptions(newType) && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Options <span className="text-muted-foreground font-normal">(one per line)</span>
              </Label>
              <Textarea
                rows={4}
                placeholder={"Option 1\nOption 2\nOption 3"}
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Default */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default</Label>
              <Input
                placeholder="Default value"
                value={newDefault}
                onChange={(e) => setNewDefault(e.target.value)}
              />
            </div>

            {/* Sort Order */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Sort Order</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
              />
            </div>

            {/* Required + Add */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={newRequired}
                  onCheckedChange={(c) => setNewRequired(!!c)}
                />
                <span className="text-sm">Required</span>
              </label>
              <Button onClick={addFieldRow} size="sm" variant="outline" className="ml-auto">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing fields list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading fields…</p>
      ) : fields.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No {entityLabel.toLowerCase()} fields found.</p>
          <p className="text-xs mt-1">Use the form above to add the first field.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((row, idx) => (
            <Card key={row.id} className="border">
              <CardContent className="pt-3 pb-3">
                <div className="grid grid-cols-[24px_1fr_180px_64px_auto_auto] gap-3 items-center">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />

                  {/* Label */}
                  <Input
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    placeholder="Field name"
                    className="text-sm"
                  />

                  {/* Type */}
                  <Select
                    value={row.type}
                    onValueChange={(v) => updateRow(row.id, { type: v as CustomFieldType })}
                  >
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-sm">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Sort Order */}
                  <Input
                    type="number"
                    value={row.sort_order}
                    onChange={(e) =>
                      updateRow(row.id, { sort_order: parseInt(e.target.value) || idx + 1 })
                    }
                    className="text-sm text-center"
                  />

                  {/* Required */}
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm whitespace-nowrap">
                    <Checkbox
                      checked={row.required}
                      onCheckedChange={(c) => updateRow(row.id, { required: !!c })}
                    />
                    Required
                  </label>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Options sub-row */}
                {hasOptions(row.type) && (
                  <div className="mt-3 ml-8 space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Options <span className="font-normal">(one per line)</span>
                    </Label>
                    <Textarea
                      rows={3}
                      value={row.options}
                      onChange={(e) => updateRow(row.id, { options: e.target.value })}
                      placeholder={"Option 1\nOption 2\nOption 3"}
                      className="text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <button
            onClick={addFieldRow}
            className="flex items-center gap-2 text-sm text-primary hover:underline pt-2"
          >
            <Plus className="h-4 w-4" /> Add another field
          </button>
        </div>
      )}
    </div>
  );
}
