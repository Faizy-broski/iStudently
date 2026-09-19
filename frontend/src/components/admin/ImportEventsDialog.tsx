"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCampus } from "@/context/CampusContext";
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods";
import { getGradeLevels, type GradeLevel } from "@/lib/api/academics";
import { bulkCreateEvents, type BulkEventRow } from "@/lib/api/events";

const CATEGORIES = ["academic", "holiday", "exam", "meeting", "activity", "reminder"];

interface ParsedRow extends BulkEventRow {
  gradeNames: string[];
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

/** Cell value -> YYYY-MM-DD (accepts Excel dates, ISO strings and DD/MM/YYYY). */
function toIsoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v ?? "").trim();
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return s.slice(0, 10);
}

function outsidePeriod(r: { start_date: string; end_date?: string }, mp?: MarkingPeriod) {
  if (!mp?.start_date || !mp.end_date || !r.start_date) return false;
  return r.start_date < mp.start_date || (r.end_date || r.start_date) > mp.end_date;
}

export function ImportEventsDialog({ open, onOpenChange, onImported }: Props) {
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [periods, setPeriods] = useState<MarkingPeriod[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ row: number; error: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setPeriodId(""); setRows([]); setFileName(""); setServerErrors([]);
    getMarkingPeriods(campusId)
      .then((p) => setPeriods(p.filter((mp) => mp.start_date && mp.end_date)))
      .catch(() => setPeriods([]));
    getGradeLevels(campusId).then((r) => setGrades(r.data || [])).catch(() => setGrades([]));
  }, [open, campusId]);

  const period = periods.find((p) => p.id === periodId);
  const periodMessage = period ? `Outside marking period (${period.start_date} → ${period.end_date})` : "";

  const downloadTemplate = () => {
    const example = period?.start_date ?? "2026-09-20";
    const ws = XLSX.utils.aoa_to_sheet([
      ["Title", "Category", "Start Date", "End Date", "Grades", "Description", "Color"],
      ["Mid-term exams", "exam", example, example, "", "Exam week", "#dc2626"],
      ["Parents meeting", "meeting", example, example, grades[0]?.name ?? "Grade 1", "", ""],
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 30 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Events");
    const help = XLSX.utils.aoa_to_sheet([
      ["Column", "Notes"],
      ["Title", "Required"],
      ["Category", `Required - one of: ${CATEGORIES.join(", ")}`],
      ["Start Date / End Date", "YYYY-MM-DD. End Date is optional (single-day event). Must be inside the marking period."],
      ["Grades", "Optional. Grade names separated by ; - leave empty for a school-wide event."],
      ["Description / Color", "Optional. Color is a hex value like #dc2626."],
    ]);
    XLSX.utils.book_append_sheet(wb, help, "Instructions");
    XLSX.writeFile(wb, "events-import-template.xlsx");
  };

  const parseFile = (file: File) => {
    setFileName(file.name);
    setServerErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary", cellDates: true });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }) as Record<string, unknown>[];
        const get = (r: Record<string, unknown>, ...keys: string[]) => {
          for (const k of Object.keys(r)) {
            if (keys.includes(k.trim().toLowerCase().replace(/[\s_]+/g, ""))) return r[k];
          }
          return "";
        };
        const byName = new Map(grades.map((g) => [g.name.trim().toLowerCase(), g.id]));
        const parsed: ParsedRow[] = raw.map((r, i) => {
          const gradeNames = String(get(r, "grades", "grade", "targetgrades") ?? "")
            .split(/[;,]/).map((s) => s.trim()).filter(Boolean);
          const unknown = gradeNames.filter((n) => !byName.has(n.toLowerCase()));
          const start = toIsoDate(get(r, "startdate", "start"));
          const row: ParsedRow = {
            row: i + 2, // header is row 1
            title: String(get(r, "title", "event", "name") ?? "").trim(),
            category: String(get(r, "category", "type") ?? "").trim().toLowerCase(),
            start_date: start,
            end_date: toIsoDate(get(r, "enddate", "end")) || start,
            description: String(get(r, "description", "notes") ?? "").trim(),
            color_code: String(get(r, "color", "colour", "colorcode") ?? "").trim(),
            gradeNames,
            target_grades: gradeNames.map((n) => byName.get(n.toLowerCase())).filter(Boolean) as string[],
          };
          if (!row.title && !row.start_date && !row.category) row.error = "__empty__";
          else if (unknown.length) row.error = `Unknown grade: ${unknown.join(", ")}`;
          else if (outsidePeriod(row, period)) row.error = periodMessage;
          return row;
        }).filter((r) => r.error !== "__empty__");
        setRows(parsed);
        if (parsed.length === 0) toast.error("No event rows found in the file");
      } catch {
        toast.error("Could not read that file - use the template (.xlsx or .csv)");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Re-check dates if the marking period is changed after a file was loaded
  useEffect(() => {
    if (!period) return;
    setRows((prev) => prev.map((r) => {
      if (r.error && !r.error.startsWith("Outside marking period")) return r;
      return { ...r, error: outsidePeriod(r, period) ? periodMessage : undefined };
    }));
  }, [period?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const invalidCount = rows.length - valid.length;

  const handleImport = async () => {
    if (!periodId || valid.length === 0) return;
    setImporting(true);
    try {
      const res = await bulkCreateEvents({
        marking_period_id: periodId,
        campus_id: campusId ?? null,
        events: valid.map(({ gradeNames, error, ...r }) => r),
      });
      if (!res.success || !res.data) { toast.error(res.error || "Import failed"); return; }
      const { created, errors } = res.data;
      setServerErrors(errors);
      if (created > 0) {
        toast.success(`${created} event${created !== 1 ? "s" : ""} imported`);
        onImported();
      }
      if (errors.length === 0) onOpenChange(false);
      else toast.warning(`${errors.length} row${errors.length !== 1 ? "s" : ""} were skipped`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import school events</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet of events for one marking period. They appear in School Events and on the exported academic calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>1. Marking period</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue placeholder="Choose the marking period these events belong to" /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title} ({p.start_date} → {p.end_date})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {periods.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No marking periods with start and end dates found - set dates on the Marking Periods page first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>2. Spreadsheet</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" /> Download template
              </Button>
              <Button type="button" size="sm" disabled={!periodId} onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Choose file (.xlsx / .csv)
              </Button>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }}
              />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{valid.length} ready</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{invalidCount} with problems (will be skipped)
                  </Badge>
                )}
              </div>
              <div className="border rounded-md max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2">Row</th><th className="p-2">Title</th><th className="p-2">Category</th>
                      <th className="p-2">Dates</th><th className="p-2">Grades</th><th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} className="border-t">
                        <td className="p-2">{r.row}</td>
                        <td className="p-2">{r.title || "-"}</td>
                        <td className="p-2">{r.category || "-"}</td>
                        <td className="p-2 whitespace-nowrap">
                          {r.start_date}{r.end_date && r.end_date !== r.start_date ? ` → ${r.end_date}` : ""}
                        </td>
                        <td className="p-2">{r.gradeNames.length ? r.gradeNames.join(", ") : "All"}</td>
                        <td className="p-2">
                          {r.error ? <span className="text-destructive">{r.error}</span> : <span className="text-green-600">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {serverErrors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
              <p className="font-medium text-destructive">The server skipped these rows:</p>
              {serverErrors.map((e) => <p key={e.row}>Row {e.row}: {e.error}</p>)}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleImport} disabled={!periodId || valid.length === 0 || importing} className="gap-2">
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Import {valid.length > 0 ? `${valid.length} event${valid.length !== 1 ? "s" : ""}` : "events"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
