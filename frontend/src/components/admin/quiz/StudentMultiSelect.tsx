"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface StudentOption {
  id: string;
  name: string;
  subtitle?: string;
}

interface Props {
  options: StudentOption[];
  value: string[]; // selected student ids
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

/**
 * Multi-select keyed by student id (label shows the name). Unlike ui/multi-select
 * (which is label-based), this stores stable UUIDs — used for targeted quiz
 * assignment (quizzes.assigned_student_ids).
 */
export function StudentMultiSelect({
  options,
  value,
  onChange,
  placeholder = "All students in section",
  emptyText = "No students found",
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const byId = React.useMemo(() => {
    const m = new Map<string, StudentOption>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10"
          type="button"
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1 items-center">
            {value.length > 0 ? (
              value.map((id) => (
                <Badge key={id} variant="secondary" className="whitespace-nowrap">
                  {byId.get(id)?.name ?? id.slice(0, 8)}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                    className="ml-1 rounded-full hover:bg-muted cursor-pointer inline-flex shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-auto p-2">
          {filtered.length > 0 ? (
            filtered.map((o) => (
              <div
                key={o.id}
                className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                onClick={() => toggle(o.id)}
              >
                <Checkbox checked={value.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
                <label className="flex-1 cursor-pointer text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span>{o.name}</span>
                    {value.includes(o.id) && <Check className="h-4 w-4 shrink-0" />}
                  </div>
                  {o.subtitle && (
                    <div className="text-xs text-muted-foreground">{o.subtitle}</div>
                  )}
                </label>
              </div>
            ))
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">{emptyText}</div>
          )}
          {value.length > 0 && (
            <div className="p-2 border-t mt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="w-full">
                Clear all
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
