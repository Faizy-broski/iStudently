
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampus } from "@/context/CampusContext";
import { useStaff } from "@/hooks/useStaff";
import { UniversalFilter, type FilterState } from "@/components/filters/UniversalFilter";
import { CustomFieldsRenderer } from "@/components/admin/CustomFieldsRenderer";
import { getFieldDefinitions, type CustomFieldDefinition } from "@/lib/api/custom-fields";
import { groupAssignStaff } from "@/lib/api/staff";
import { useLocale } from "next-intl";

const DONT_CHANGE = "__dont_change__";

export default function GroupAssignStaffPage() {
  const t = useTranslations("common");
  const router = useRouter();
  const campusCtx = useCampus();
  const locale = useLocale();

  const [filters, setFilters] = useState<FilterState>({});
  const [showInactive, setShowInactive] = useState(false);
  
  const queryResult = useStaff({
    limit: 1000,
    search: filters.search || undefined,
    is_active: showInactive ? undefined : true,
  });
  
  const staffList = queryResult.staff || queryResult.data || [];
  const loading = queryResult.loading;
  const refresh = queryResult.refresh || (() => {});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(staffList.map((s: any) => s.id)) : new Set());
  };

  const [assignStatus, setAssignStatus] = useState<"unchanged" | "active" | "inactive">("unchanged");

  const [fieldDefs, setFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [touchedFieldKeys, setTouchedFieldKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFieldDefinitions("staff", campusCtx?.selectedCampus?.id).then((res) => {
      if (res.success && res.data) setFieldDefs(res.data);
    });
  }, [campusCtx?.selectedCampus?.id]);

  const handleCustomFieldsChange = (newValues: Record<string, any>) => {
    setTouchedFieldKeys((prev) => {
      const next = new Set(prev);
      for (const key of Object.keys(newValues)) {
        if (newValues[key] !== customFieldValues[key]) next.add(key);
      }
      return next;
    });
    setCustomFieldValues(newValues);
  };

  const [saving, setSaving] = useState(false);

  const resetAssignForm = () => {
    setAssignStatus("unchanged");
    setCustomFieldValues({});
    setTouchedFieldKeys(new Set());
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one record");
      return;
    }

    const customFieldUpdates: { category_id: string; field_key: string; value: any }[] = [];
    for (const key of touchedFieldKeys) {
      const def = fieldDefs.find((f) => f.field_key === key);
      if (!def) continue;
      const value = customFieldValues[key];
      const isBlank =
        def.type === "checkbox"
          ? false
          : def.type === "multi-select"
            ? !Array.isArray(value) || value.length === 0
            : value === "" || value === null || value === undefined;
      if (isBlank) continue;
      customFieldUpdates.push({ category_id: def.category_id, field_key: key, value });
    }

    const statusChanged = assignStatus !== "unchanged";

    if (!statusChanged && customFieldUpdates.length === 0) {
      toast.error("Nothing to assign");
      return;
    }

    setSaving(true);
    try {
      const res = await groupAssignStaff({
        staff_ids: Array.from(selectedIds),
        is_active: statusChanged ? assignStatus === "active" : undefined,
        custom_field_updates: customFieldUpdates,
        campus_id: campusCtx?.selectedCampus?.id,
      });

      if (!res || (res.success === false) || !res.data) {
        toast.error((res as any)?.error || "Operation failed");
        return;
      }

      if (res.data.errors.length > 0) {
        toast.warning(`Partial success: ${res.data.updated} updated, ${res.data.errors.length} failed`);
      } else {
        toast.success(`Success: ${res.data.updated} updated`);
      }

      setSelectedIds(new Set());
      resetAssignForm();
      if (refresh) refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || selectedIds.size === 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-1 text-muted-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Group Assign Staff
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saveDisabled} className="gradient-blue text-white border-0 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      <Card>
        <CardContent className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as typeof assignStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unchanged">Don't Change</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <CustomFieldsRenderer
            entityType="staff"
            values={customFieldValues}
            onChange={handleCustomFieldsChange}
            campusId={campusCtx?.selectedCampus?.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 space-y-3">
          <UniversalFilter
            availableFilters={["search"]}
            entityType="staff"
            currentFilters={filters}
            onFilterChange={(f) => {
              setFilters(f);
              setSelectedIds(new Set());
            }}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => {
                setShowInactive(e.target.checked);
                setSelectedIds(new Set());
              }}
              className="rounded border-gray-300"
            />
            Show Inactive
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium text-muted-foreground">
              {staffList.length} found
            </span>
            {selectedIds.size > 0 && (
              <span className="text-sm text-primary font-medium">{selectedIds.size} selected</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={staffList.length > 0 && selectedIds.size === staffList.length}
                        onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((item: any) => (
                    <TableRow
                      key={item.id}
                      className={selectedIds.has(item.id) ? "bg-primary/5" : undefined}
                      onClick={() => toggleSelectOne(item.id, !selectedIds.has(item.id))}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) => toggleSelectOne(item.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.profile?.first_name} {item.profile?.last_name}
                      </TableCell>
                      <TableCell>
                        {item.profile?.is_active || item.is_active ? "Active" : "Inactive"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {staffList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No results found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
