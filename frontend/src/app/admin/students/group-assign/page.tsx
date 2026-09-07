"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useStudents } from "@/hooks/useStudents";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { UniversalFilter, type FilterState } from "@/components/filters/UniversalFilter";
import { CustomFieldsRenderer } from "@/components/admin/CustomFieldsRenderer";
import { getFieldDefinitions, type CustomFieldDefinition } from "@/lib/api/custom-fields";
import { groupAssignStudents } from "@/lib/api/students";

// Sentinels for the assign-form selects — a select's value can never be "",
// so "leave unchanged" needs its own explicit value distinct from a real id.
const DONT_CHANGE = "__dont_change__";

export default function GroupAssignStudentsPage() {
  const t = useTranslations("school.students.group_assign");
  const tStudents = useTranslations("school.students");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const campusCtx = useCampus();

  // ── Candidate list (unpaginated — "select all" must cover every filtered match) ──
  const [filters, setFilters] = useState<FilterState>({});
  const { students, loading, refresh } = useStudents({
    limit: 1000,
    search: filters.search || undefined,
    grade_level: filters.gradeNames?.length ? filters.gradeNames : undefined,
    section_id: filters.sectionId || undefined,
  });

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
    setSelectedIds(checked ? new Set(students.map((s) => s.id)) : new Set());
  };

  // ── Assign form: "leave blank/unchanged = don't touch" ──
  const { gradeLevels: allGrades, loading: loadingGrades } = useGradeLevels();
  const { sections: allSections, loading: loadingSections } = useSections();

  const grades = useMemo(() => allGrades.filter((g) => g.is_active), [allGrades]);
  const [assignGradeId, setAssignGradeId] = useState(DONT_CHANGE);
  const [assignSectionId, setAssignSectionId] = useState(DONT_CHANGE);
  const sections = useMemo(
    () => allSections.filter((s) => s.is_active && s.grade_level_id === assignGradeId),
    [allSections, assignGradeId]
  );

  const hasAssignGrade = assignGradeId !== DONT_CHANGE;

  const [assignStatus, setAssignStatus] = useState<"unchanged" | "active" | "inactive">("unchanged");

  const [fieldDefs, setFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [touchedFieldKeys, setTouchedFieldKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFieldDefinitions("student", campusCtx?.selectedCampus?.id).then((res) => {
      if (res.success && res.data) setFieldDefs(res.data);
    });
  }, [campusCtx?.selectedCampus?.id]);

  const handleAssignGradeChange = (value: string) => {
    setAssignGradeId(value);
    setAssignSectionId(DONT_CHANGE);
  };

  // Diffs against the previous values so a field flipped/cleared back to its
  // original value is still recorded as "touched" — CustomFieldsRenderer's
  // onChange alone can't distinguish "never touched" from "touched then cleared".
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
    setAssignGradeId(DONT_CHANGE);
    setAssignSectionId(DONT_CHANGE);
    setAssignStatus("unchanged");
    setCustomFieldValues({});
    setTouchedFieldKeys(new Set());
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      toast.error(t("toast.select_student"));
      return;
    }

    // Blank = skip, per field type — a checkbox has no "blank" state, so once
    // touched it's always included (false is a deliberate answer, not an absence).
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

    const sectionChanged = assignSectionId !== DONT_CHANGE;
    const statusChanged = assignStatus !== "unchanged";

    if (!hasAssignGrade && !statusChanged && customFieldUpdates.length === 0) {
      toast.error(t("toast.nothing_to_assign"));
      return;
    }

    setSaving(true);
    try {
      const res = await groupAssignStudents({
        student_ids: Array.from(selectedIds),
        grade_level_id: hasAssignGrade ? assignGradeId : undefined,
        section_id: hasAssignGrade && sectionChanged ? assignSectionId : undefined,
        is_active: statusChanged ? assignStatus === "active" : undefined,
        custom_field_updates: customFieldUpdates,
        campus_id: campusCtx?.selectedCampus?.id,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || t("toast.operation_failed"));
        return;
      }

      if (res.data.errors.length > 0) {
        toast.warning(t("toast.partial_success", { updated: res.data.updated, failed: res.data.errors.length }));
      } else {
        toast.success(t("toast.success", { count: res.data.updated }));
      }

      setSelectedIds(new Set());
      resetAssignForm();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.operation_failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveDisabled = saving || selectedIds.size === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push("/admin/students/student-info")}
          >
            <ArrowLeft className="h-4 w-4" />
            {tStudents("student_info.title")}
          </Button>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white dark:bg-linear-to-r dark:from-[#57A3CC] dark:to-white">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
        </div>
        <Button onClick={handleSave} disabled={saveDisabled} className="gradient-blue text-white border-0 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("save_button")}
        </Button>
      </div>

      {/* Assign form */}
      <Card>
        <CardContent className="py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{tStudents("student_details.grade_level")}</Label>
              <Select value={assignGradeId} onValueChange={handleAssignGradeChange} disabled={loadingGrades}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DONT_CHANGE}>{t("dont_change")}</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tStudents("student_details.section")}</Label>
              <Select
                value={assignSectionId}
                onValueChange={setAssignSectionId}
                disabled={!hasAssignGrade || loadingSections}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !hasAssignGrade
                        ? tStudents("select_grade_first")
                        : sections.length === 0
                          ? tStudents("no_sections_available")
                          : tCommon("select_section")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DONT_CHANGE}>{t("dont_change")}</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tCommon("status")}</Label>
              <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as typeof assignStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unchanged">{t("dont_change")}</SelectItem>
                  <SelectItem value="active">{tCommon("active")}</SelectItem>
                  <SelectItem value="inactive">{tCommon("inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <CustomFieldsRenderer
            entityType="student"
            values={customFieldValues}
            onChange={handleCustomFieldsChange}
            campusId={campusCtx?.selectedCampus?.id}
          />
        </CardContent>
      </Card>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-4">
          <UniversalFilter
            availableFilters={["search", "grade", "section"]}
            entityType="students"
            currentFilters={filters}
            onFilterChange={(f) => {
              setFilters(f);
              setSelectedIds(new Set());
            }}
          />
        </CardContent>
      </Card>

      {/* Student list */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium text-muted-foreground">
              {t("students_found", { count: students.length })}
            </span>
            {selectedIds.size > 0 && (
              <span className="text-sm text-primary font-medium">{t("selected_count", { count: selectedIds.size })}</span>
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
                        checked={students.length > 0 && selectedIds.size === students.length}
                        onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      />
                    </TableHead>
                    <TableHead>{tCommon("student")}</TableHead>
                    <TableHead>{tStudents("student_info.th_student_id")}</TableHead>
                    <TableHead>{tStudents("student_details.grade_level")}</TableHead>
                    <TableHead>{tStudents("student_details.section")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow
                      key={student.id}
                      className={selectedIds.has(student.id) ? "bg-primary/5" : undefined}
                      onClick={() => toggleSelectOne(student.id, !selectedIds.has(student.id))}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={(checked) => toggleSelectOne(student.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.profile?.first_name} {student.profile?.last_name}
                      </TableCell>
                      <TableCell>{student.student_number}</TableCell>
                      <TableCell>{student.grade?.name || student.grade_level || tCommon("na")}</TableCell>
                      <TableCell>{student.section?.name || tCommon("na")}</TableCell>
                      <TableCell>
                        {student.profile?.is_active ? tCommon("active") : tCommon("inactive")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {tStudents("student_info.no_students_found")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Save button, matching the top+bottom pattern used in Mass Assign */}
      <div className="flex justify-center">
        <Button onClick={handleSave} disabled={saveDisabled} className="gradient-blue text-white border-0 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("save_button")}
        </Button>
      </div>
    </div>
  );
}
