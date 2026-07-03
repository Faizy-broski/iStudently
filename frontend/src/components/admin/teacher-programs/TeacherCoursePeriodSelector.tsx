"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { getAllTeachers } from "@/lib/api/teachers";
import * as gradesApi from "@/lib/api/grades";
import type { CoursePeriod } from "@/lib/api/grades";
import { useCampus } from "@/context/CampusContext";

interface TeacherOption {
  id: string;
  name: string;
}

export interface TeacherCoursePeriodSelection {
  teacherId: string;
  coursePeriod: CoursePeriod | null;
}

interface TeacherCoursePeriodSelectorProps {
  value: TeacherCoursePeriodSelection;
  onChange: (selection: TeacherCoursePeriodSelection) => void;
}

export function TeacherCoursePeriodSelector({ value, onChange }: TeacherCoursePeriodSelectorProps) {
  const t = useTranslations("teacherPrograms");
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  useEffect(() => {
    setLoadingTeachers(true);
    getAllTeachers({ page: 1, limit: 500, campus_id: campusId })
      .then((res) => {
        const staff = res.data ?? [];
        setTeachers(
          staff.map((s) => ({
            id: s.id,
            name: s.profile ? `${s.profile.first_name ?? ""} ${s.profile.last_name ?? ""}`.trim() : s.id,
          }))
        );
      })
      .catch(() => setTeachers([]))
      .finally(() => setLoadingTeachers(false));
  }, [campusId]);

  useEffect(() => {
    if (!value.teacherId) {
      setCoursePeriods([]);
      return;
    }
    setLoadingPeriods(true);
    gradesApi
      .getCoursePeriods(campusId)
      .then((res) => {
        const all = res.success && res.data ? res.data : [];
        setCoursePeriods(
          all.filter(
            (cp) => cp.teacher_id === value.teacherId || cp.secondary_teacher_id === value.teacherId
          )
        );
      })
      .catch(() => setCoursePeriods([]))
      .finally(() => setLoadingPeriods(false));
  }, [value.teacherId, campusId]);

  const handleTeacherChange = (teacherId: string) => {
    onChange({ teacherId, coursePeriod: null });
  };

  const handleCoursePeriodChange = (cpId: string) => {
    const cp = coursePeriods.find((c) => c.id === cpId) ?? null;
    onChange({ teacherId: value.teacherId, coursePeriod: cp });
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label>{t("selectorTeacherLabel")}</Label>
        {loadingTeachers ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground h-9 px-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("selectorLoadingTeachers")}
          </div>
        ) : (
          <Select value={value.teacherId || "__none__"} onValueChange={(v) => handleTeacherChange(v === "__none__" ? "" : v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t("selectorTeacherPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("selectorTeacherPlaceholder")}</SelectItem>
              {teachers.map((teacherOption) => (
                <SelectItem key={teacherOption.id} value={teacherOption.id}>
                  {teacherOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>{t("selectorCourseLabel")}</Label>
        {loadingPeriods ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground h-9 px-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("selectorLoadingCourses")}
          </div>
        ) : (
          <Select
            value={value.coursePeriod?.id || "__none__"}
            onValueChange={(v) => handleCoursePeriodChange(v === "__none__" ? "" : v)}
            disabled={!value.teacherId}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder={t("selectorCoursePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("selectorCoursePlaceholder")}</SelectItem>
              {coursePeriods.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t("selectorNoCoursePeriods")}
                </div>
              ) : (
                coursePeriods.map((cp) => (
                  <SelectItem key={cp.id} value={cp.id}>
                    {cp.course?.title || cp.id}
                    {cp.period?.period_name ? ` (${cp.period.period_name})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
