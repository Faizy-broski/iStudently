"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getFieldDefinitions, type CustomFieldDefinition, type EntityType } from "@/lib/api/custom-fields";

interface StudentCustomFieldsProps {
  /** The entity's `custom_fields` JSONB value, grouped by category_id.field_key */
  entityCustomFields: Record<string, any> | null | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  campusId?: string;
  entityType?: EntityType;
}

function formatValue(field: CustomFieldDefinition, rawValue: any): React.ReactNode {
  if (rawValue === undefined || rawValue === null || rawValue === "") return null;
  if (field.type === "checkbox") return rawValue ? "Yes" : "No";
  if (field.type === "date") {
    const date = new Date(rawValue);
    return isNaN(date.getTime()) ? String(rawValue) : date.toLocaleDateString();
  }
  if (Array.isArray(rawValue)) {
    return (
      <div className="flex flex-wrap gap-1">
        {rawValue.map((v: string, i: number) => (
          <Badge key={i} variant="outline">{v}</Badge>
        ))}
      </div>
    );
  }
  return String(rawValue);
}

/** Read-only display of admin-defined custom field values, grouped by category. */
export function StudentCustomFields({ entityCustomFields, campusId, entityType = "student" }: StudentCustomFieldsProps) {
  const [defs, setDefs] = useState<CustomFieldDefinition[]>([]);

  useEffect(() => {
    getFieldDefinitions(entityType, campusId).then((res) => {
      if (res.success && res.data) setDefs(res.data);
    });
  }, [entityType, campusId]);

  if (defs.length === 0) return null;

  const categories = Array.from(new Set(defs.map((f) => f.category_id)));
  const rows = categories
    .map((categoryId) => {
      const fields = defs
        .filter((f) => f.category_id === categoryId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((field) => ({ field, value: formatValue(field, entityCustomFields?.[categoryId]?.[field.field_key]) }))
        .filter((r) => r.value !== null);
      return { categoryId, categoryName: fields[0]?.field.category_name || categoryId, fields };
    })
    .filter((c) => c.fields.length > 0);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom Fields</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((category, idx) => (
          <div key={category.categoryId}>
            {idx > 0 && <Separator className="mb-4" />}
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{category.categoryName}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {category.fields.map(({ field, value }) => (
                <div key={field.field_key} className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{field.label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
