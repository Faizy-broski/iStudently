"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import type { Student, UpdateStudentDTO } from "@/lib/api/students";

interface ReassignGradeSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  updateStudent: (id: string, data: UpdateStudentDTO) => Promise<Student | undefined>;
  refresh: () => Promise<unknown>;
}

const NO_SECTION = "__none__";

/**
 * Takes updateStudent/refresh from the page's existing useStudents() instance
 * rather than calling the hook again here — a second independent useStudents()
 * call would be keyed differently (the page's is keyed on {page:1,limit:1000|0}),
 * so its optimistic merge/revalidation would never reach what the page renders.
 */
export function ReassignGradeSectionDialog({
  open,
  onOpenChange,
  student,
  updateStudent,
  refresh,
}: ReassignGradeSectionDialogProps) {
  const t = useTranslations("school.students.student_details");
  const tStudents = useTranslations("school.students");
  const tCommon = useTranslations("common");

  const { gradeLevels: allGrades, loading: isLoadingGrades } = useGradeLevels();
  const { sections: allSections, loading: isLoadingSections } = useSections();
  const [selectedGradeId, setSelectedGradeId] = useState(student.grade?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState(student.section?.id || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedGradeId(student.grade?.id || "");
      setSelectedSectionId(student.section?.id || "");
    }
  }, [open, student.grade?.id, student.section?.id]);

  const grades = useMemo(() => allGrades.filter((g) => g.is_active), [allGrades]);

  const sections = useMemo(
    () =>
      allSections.filter(
        (s) =>
          s.is_active &&
          s.grade_level_id === selectedGradeId &&
          // The student's own current section is always included, even if
          // otherwise full — staying put is always a valid choice.
          (s.id === student.section?.id || (s.available_seats ?? s.capacity - s.current_strength) > 0)
      ),
    [allSections, selectedGradeId, student.section?.id]
  );

  const handleSave = async () => {
    if (!selectedGradeId) return;
    setIsSaving(true);
    try {
      const gradeName = grades.find((g) => g.id === selectedGradeId)?.name;
      await updateStudent(student.id, {
        grade_level_id: selectedGradeId,
        grade_level: gradeName,
        section_id: selectedSectionId || null,
      });
      await refresh();
      toast.success(t("reassign_success"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reassign_error_generic"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("reassign_title")}</DialogTitle>
          <DialogDescription>{t("reassign_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("grade_level")}</Label>
            <Select
              value={selectedGradeId}
              onValueChange={(value) => {
                setSelectedGradeId(value);
                setSelectedSectionId("");
              }}
              disabled={isLoadingGrades}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingGrades ? tCommon("loading") : tStudents("select_grade_first")} />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("section")}</Label>
            <Select
              value={selectedSectionId || NO_SECTION}
              onValueChange={(v) => setSelectedSectionId(v === NO_SECTION ? "" : v)}
              disabled={!selectedGradeId || isLoadingSections}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedGradeId
                      ? tStudents("select_grade_first")
                      : isLoadingSections
                        ? tCommon("loading")
                        : sections.length === 0
                          ? tStudents("no_sections_available")
                          : tCommon("select_section")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SECTION}>{t("unassigned")}</SelectItem>
                {sections.map((section) => {
                  const seats = section.available_seats ?? section.capacity - section.current_strength;
                  return (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name} — {seats}/{section.capacity} {t("seats_available")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!selectedGradeId || isSaving} className="gradient-blue text-white border-0">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
