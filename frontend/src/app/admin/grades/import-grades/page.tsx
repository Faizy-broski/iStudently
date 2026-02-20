"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  getCoursePeriods,
  getAssignmentOptions,
  getMarkingPeriods,
  importGradebookGrades,
} from "@/lib/api/grades";
import type {
  CoursePeriod,
  AssignmentOption,
  ImportGradesResult,
} from "@/lib/api/grades";
import type { MarkingPeriodOption } from "@/lib/api/grades";

// ═════════════════════════════════════════════════════════════════
// COLUMN LETTER HELPER (A, B, C, ... Z, AA, AB, ...)
// ═════════════════════════════════════════════════════════════════
function colLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// ═════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════
export default function ImportGradesPage() {
  const { user, profile } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Selectors state ───────────────────────────────────────────
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriodOption[]>([]);
  const [selectedCoursePeriod, setSelectedCoursePeriod] = useState("");
  const [selectedMarkingPeriod, setSelectedMarkingPeriod] = useState("");
  const [loadingCPs, setLoadingCPs] = useState(true);

  // ── File state ────────────────────────────────────────────────
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState<string[]>([]);
  const [importFirstRow, setImportFirstRow] = useState(false);

  // ── Column mapping state ──────────────────────────────────────
  const [studentIdentifier, setStudentIdentifier] = useState<"name" | "student_number">("name");
  const [firstNameCol, setFirstNameCol] = useState<number | undefined>(undefined);
  const [lastNameCol, setLastNameCol] = useState<number | undefined>(undefined);
  const [studentNumberCol, setStudentNumberCol] = useState<number | undefined>(undefined);

  // ── Assignment mappings ───────────────────────────────────────
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [assignmentMappings, setAssignmentMappings] = useState<Map<string, number | undefined>>(new Map());
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // ── Import state ──────────────────────────────────────────────
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportGradesResult | null>(null);

  // ── Load course periods + marking periods ─────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingCPs(true);
    Promise.all([
      getCoursePeriods(selectedCampus?.id),
      getMarkingPeriods(selectedCampus?.id),
    ])
      .then(([cpRes, mpRes]) => {
        if (cpRes.success && cpRes.data) setCoursePeriods(cpRes.data);
        if (mpRes.success && mpRes.data) setMarkingPeriods(mpRes.data as MarkingPeriodOption[]);
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoadingCPs(false));
  }, [user, selectedCampus?.id]);

  // ── Load assignments when course period changes ───────────────
  useEffect(() => {
    if (!selectedCoursePeriod) {
      setAssignments([]);
      setAssignmentMappings(new Map());
      return;
    }
    setLoadingAssignments(true);
    getAssignmentOptions({
      course_period_id: selectedCoursePeriod,
      marking_period_id: selectedMarkingPeriod || undefined,
    })
      .then((res) => {
        if (res.success && res.data) {
          // Filter to only actual assignments (not types or totals)
          const assgns = res.data.filter((a) => a.type === "assignment");
          setAssignments(assgns);
          setAssignmentMappings(new Map(assgns.map((a) => [a.id, undefined])));
        }
      })
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoadingAssignments(false));
  }, [selectedCoursePeriod, selectedMarkingPeriod]);

  // ── File parsing ──────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      // Excel parsing via SheetJS
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          });
          if (jsonData.length === 0) {
            toast.error("The file appears to be empty");
            return;
          }
          setParsedRows(jsonData);
          setHeaderRow(jsonData[0] || []);
        } catch {
          toast.error("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV parsing via PapaParse
      Papa.parse(file, {
        complete: (result) => {
          const rows = result.data as string[][];
          if (rows.length === 0) {
            toast.error("The file appears to be empty");
            return;
          }
          setParsedRows(rows);
          setHeaderRow(rows[0] || []);
        },
        error: () => toast.error("Failed to parse CSV file"),
        skipEmptyLines: true,
      });
    }

    // Reset the file input so the same file can be re-selected
    e.target.value = "";
  }, []);

  // ── Build column options ──────────────────────────────────────
  const columnOptions = headerRow.map((header, idx) => ({
    value: idx,
    label: `${colLetter(idx)}: ${header || `Column ${idx + 1}`}`,
  }));

  // ── Data row count ────────────────────────────────────────────
  const dataRowCount = importFirstRow ? parsedRows.length : Math.max(0, parsedRows.length - 1);

  // ── Assignment column selectors grouped by type ───────────────
  const assignmentGroups = assignments.reduce<
    { typeTitle: string; items: AssignmentOption[] }[]
  >((groups, a) => {
    // For simplicity, group all assignments in a flat list
    // The assignment_type info isn't directly on AssignmentOption;
    // we show each assignment with a mapping dropdown
    if (groups.length === 0 || groups[groups.length - 1].typeTitle !== "Assignments") {
      groups.push({ typeTitle: "Assignments", items: [] });
    }
    groups[groups.length - 1].items.push(a);
    return groups;
  }, []);

  // ── Reset form ────────────────────────────────────────────────
  const resetForm = () => {
    setFileName("");
    setParsedRows([]);
    setHeaderRow([]);
    setImportFirstRow(false);
    setStudentIdentifier("name");
    setFirstNameCol(undefined);
    setLastNameCol(undefined);
    setStudentNumberCol(undefined);
    setAssignmentMappings(new Map(assignments.map((a) => [a.id, undefined])));
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Import handler ────────────────────────────────────────────
  const handleImport = async () => {
    if (!selectedCoursePeriod) {
      toast.error("Please select a course period");
      return;
    }
    if (parsedRows.length === 0) {
      toast.error("Please upload a file first");
      return;
    }

    // Build mappings — only assignments that have a column mapped
    const mappings: { assignment_id: string; column_index: number }[] = [];
    for (const [assignmentId, colIdx] of assignmentMappings.entries()) {
      if (colIdx !== undefined) {
        mappings.push({ assignment_id: assignmentId, column_index: colIdx });
      }
    }

    if (mappings.length === 0) {
      toast.error("Please map at least one assignment column");
      return;
    }

    // Validate student identifier columns
    if (studentIdentifier === "name") {
      if (firstNameCol === undefined && lastNameCol === undefined) {
        toast.error("Please select at least one name column (First Name or Last Name)");
        return;
      }
    } else {
      if (studentNumberCol === undefined) {
        toast.error("Please select the Student Number column");
        return;
      }
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await importGradebookGrades({
        course_period_id: selectedCoursePeriod,
        import_first_row: importFirstRow,
        student_identifier: studentIdentifier,
        name_columns:
          studentIdentifier === "name"
            ? { first_name_col: firstNameCol, last_name_col: lastNameCol }
            : undefined,
        student_number_col:
          studentIdentifier === "student_number" ? studentNumberCol : undefined,
        mappings,
        rows: parsedRows,
      });

      if (res.success && res.data) {
        setImportResult(res.data);
        if (res.data.imported > 0 && res.data.errors.length === 0) {
          toast.success(`Successfully imported grades for ${res.data.imported} students`);
        } else if (res.data.imported > 0) {
          toast.success(`Imported ${res.data.imported} students with ${res.data.errors.length} issue(s)`);
        } else {
          toast.error("No grades were imported");
        }
      } else {
        toast.error("Import failed");
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  // ── Get selected course period label ──────────────────────────
  const selectedCP = coursePeriods.find((cp) => cp.id === selectedCoursePeriod);
  const cpLabel = selectedCP
    ? `${selectedCP.course?.title || "Course"} — ${selectedCP.teacher?.first_name || ""} ${selectedCP.teacher?.last_name || ""}`
    : "";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#0369a1] to-[#0284c7] flex items-center justify-center">
          <Upload className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">
            Import Grades
            {selectedMarkingPeriod &&
              markingPeriods.find((mp) => mp.id === selectedMarkingPeriod) &&
              ` - ${markingPeriods.find((mp) => mp.id === selectedMarkingPeriod)!.title}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Import gradebook grades from CSV or Excel file
          </p>
        </div>
      </div>

      {/* Selection bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Course Period */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Course Period
              </label>
              {loadingCPs ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedCoursePeriod}
                  onValueChange={setSelectedCoursePeriod}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course period..." />
                  </SelectTrigger>
                  <SelectContent>
                    {coursePeriods.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.course?.title || "Course"} —{" "}
                        {cp.teacher?.first_name || ""}{" "}
                        {cp.teacher?.last_name || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Marking Period / Quarter */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Quarter / Marking Period
              </label>
              <Select
                value={selectedMarkingPeriod}
                onValueChange={setSelectedMarkingPeriod}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All marking periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Marking Periods</SelectItem>
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File upload */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Upload File
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {fileName || "Choose CSV / Excel..."}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File info bar + Import button */}
      {parsedRows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              {fileName}: {parsedRows.length} rows
            </Badge>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={importFirstRow}
                onCheckedChange={(v) => setImportFirstRow(!!v)}
              />
              Import first row
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-[#0369a1] hover:bg-[#0369a1]/90"
              onClick={handleImport}
              disabled={importing || !selectedCoursePeriod}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              IMPORT GRADEBOOK GRADES
            </Button>
            <Button variant="link" className="text-[#0369a1]" onClick={resetForm}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset form
            </Button>
          </div>
        </div>
      )}

      {/* Column mapping form */}
      {parsedRows.length > 0 && selectedCoursePeriod && (
        <Card>
          <CardContent className="p-6">
            <div className="max-w-lg mx-auto space-y-6">
              <h2 className="text-lg font-semibold">Gradebook Grades Fields</h2>

              {/* Student identifier selector */}
              <div className="space-y-3">
                <div>
                  <Select
                    value={studentIdentifier}
                    onValueChange={(v) =>
                      setStudentIdentifier(v as "name" | "student_number")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="student_number">
                        Student Number
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Identify Student
                  </p>
                </div>

                {/* Name columns */}
                {studentIdentifier === "name" && (
                  <>
                    <div>
                      <Select
                        value={firstNameCol !== undefined ? String(firstNameCol) : ""}
                        onValueChange={(v) => setFirstNameCol(v ? Number(v) : undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columnOptions.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-red-500 mt-1">First Name</p>
                    </div>

                    <div>
                      <Select
                        value={lastNameCol !== undefined ? String(lastNameCol) : ""}
                        onValueChange={(v) => setLastNameCol(v ? Number(v) : undefined)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columnOptions.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-red-500 mt-1">Last Name</p>
                    </div>
                  </>
                )}

                {/* Student number column */}
                {studentIdentifier === "student_number" && (
                  <div>
                    <Select
                      value={
                        studentNumberCol !== undefined
                          ? String(studentNumberCol)
                          : ""
                      }
                      onValueChange={(v) =>
                        setStudentNumberCol(v ? Number(v) : undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-red-500 mt-1">Student Number</p>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="border-t pt-4">
                <h3 className="text-base font-semibold mb-3">Assignments</h3>

                {loadingAssignments ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No assignments found for this course period.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((a) => (
                      <div key={a.id}>
                        <Select
                          value={
                            assignmentMappings.get(a.id) !== undefined
                              ? String(assignmentMappings.get(a.id))
                              : ""
                          }
                          onValueChange={(v) => {
                            const next = new Map(assignmentMappings);
                            next.set(a.id, v ? Number(v) : undefined);
                            setAssignmentMappings(next);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Skip —</SelectItem>
                            {columnOptions.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.title}
                          {a.points ? ` (${a.points} pts)` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Import button */}
      {parsedRows.length > 0 && selectedCoursePeriod && (
        <div className="flex justify-center">
          <Button
            className="bg-[#0369a1] hover:bg-[#0369a1]/90 px-8"
            onClick={handleImport}
            disabled={importing || !selectedCoursePeriod}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            IMPORT GRADEBOOK GRADES
          </Button>
        </div>
      )}

      {/* Import results */}
      {importResult && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                Import Results
              </h3>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-700">
                    {importResult.imported}
                  </div>
                  <div className="text-xs text-green-600">Students Imported</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-yellow-700">
                    {importResult.skipped}
                  </div>
                  <div className="text-xs text-yellow-600">Skipped</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-700">
                    {importResult.errors.length}
                  </div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Error Details:</h4>
                  <div className="max-h-48 overflow-y-auto bg-muted/50 rounded-lg p-3 space-y-1">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-600 flex gap-2">
                        <span className="font-medium whitespace-nowrap">
                          Row {err.row}:
                        </span>
                        <span>{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state — no file uploaded yet */}
      {parsedRows.length === 0 && !loadingCPs && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
              Upload a Grades File
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Select a course period above, then upload a CSV or Excel file containing
              student grades. You&apos;ll map the file columns to assignments before importing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
