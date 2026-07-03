"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Calendar, RefreshCw, UserCheck } from "lucide-react";
import { useCampus } from "@/context/CampusContext";
import * as timetableApi from "@/lib/api/timetable";
import { TeacherSchedule, getAllTeachers } from "@/lib/api/teachers";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface StudentWithAttendance {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  status: AttendanceStatus;
  remarks?: string;
}

interface TeacherOption {
  id: string;
  name: string;
}

export default function AdminTeacherProgramsAttendancePage() {
  const t = useTranslations("teacherPrograms.attendance");
  const tSelector = useTranslations("teacherPrograms");
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [attendanceData, setAttendanceData] = useState<StudentWithAttendance[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

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

  const { data: schedule = [], isLoading: scheduleLoading } = useSWR(
    selectedTeacherId && selectedDate ? [`admin-teacher-schedule-${selectedTeacherId}`, selectedDate] : null,
    () => timetableApi.getTeacherSchedule(selectedTeacherId, selectedDate),
    { revalidateOnFocus: false }
  );

  const todayClasses = schedule || [];
  const selectedClass = useMemo(
    () => todayClasses.find((s: TeacherSchedule) => s.id === selectedClassId) || null,
    [todayClasses, selectedClassId]
  );

  useEffect(() => {
    setSelectedClassId("");
    setAttendanceData([]);
  }, [selectedTeacherId]);

  useEffect(() => {
    if (!selectedClassId && todayClasses.length > 0) {
      setSelectedClassId(todayClasses[0].id);
    } else if (selectedClassId && todayClasses.length > 0 && !todayClasses.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(todayClasses[0].id);
    }
  }, [todayClasses, selectedClassId]);

  const loadAttendanceData = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingAttendance(true);
    try {
      const records = await timetableApi.getAttendanceForClass(selectedClassId, selectedDate);
      setAttendanceData(
        records.map((r) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.student_name || "Unknown Student",
          student_number: r.student_number || "",
          status: r.status as AttendanceStatus,
          remarks: r.remarks ?? undefined,
        }))
      );
      setHasChanges(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedClassId, selectedDate, t]);

  useEffect(() => {
    if (selectedClassId) loadAttendanceData();
  }, [selectedClassId, loadAttendanceData]);

  const setStatus = (studentId: string, newStatus: AttendanceStatus) => {
    setAttendanceData((prev) => prev.map((s) => (s.student_id === studentId ? { ...s, status: newStatus } : s)));
    setHasChanges(true);
  };

  const updateRemarks = (studentId: string, remarks: string) => {
    setAttendanceData((prev) => prev.map((s) => (s.student_id === studentId ? { ...s, remarks } : s)));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedClassId) {
      toast.error(t("noClassSelected"));
      return;
    }
    setSaving(true);
    try {
      const updates = attendanceData.map((record) => ({
        student_id: record.student_id,
        status: record.status,
        remarks: record.remarks,
      }));
      await timetableApi.bulkUpdateAttendance(selectedClassId, selectedDate, updates);
      setHasChanges(false);
      toast.success(t("saveSuccess"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: attendanceData.length,
      present: attendanceData.filter((r) => r.status === "present").length,
      absent: attendanceData.filter((r) => r.status === "absent").length,
      late: attendanceData.filter((r) => r.status === "late").length,
    }),
    [attendanceData]
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-2">
        <UserCheck className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("teacherLabel")}</label>
              {loadingTeachers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground h-9 px-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {tSelector("selectorLoadingTeachers")}
                </div>
              ) : (
                <Select value={selectedTeacherId || "__none__"} onValueChange={(v) => setSelectedTeacherId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={tSelector("selectorTeacherPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{tSelector("selectorTeacherPlaceholder")}</SelectItem>
                    {teachers.map((teacherOption) => (
                      <SelectItem key={teacherOption.id} value={teacherOption.id}>{teacherOption.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {t("dateLabel")}
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-40"
              />
            </div>

            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <label className="text-sm font-medium">{t("classLabel")}</label>
              <Select
                value={selectedClassId || "__none__"}
                onValueChange={(v) => setSelectedClassId(v === "__none__" ? "" : v)}
                disabled={!selectedTeacherId || scheduleLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={scheduleLoading ? t("loadingClasses") : t("classPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("classPlaceholder")}</SelectItem>
                  {todayClasses.map((cls: TeacherSchedule) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {`Period ${cls.period_number} — ${cls.subject_name} · ${cls.section_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="icon" onClick={loadAttendanceData} title="Refresh" disabled={!selectedClassId}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {selectedClass && (
            <div className="text-sm text-muted-foreground">
              {selectedClass.subject_name} • {selectedClass.section_name} · Period {selectedClass.period_number} ·{" "}
              {selectedClass.start_time?.substring(0, 5)} - {selectedClass.end_time?.substring(0, 5)}
              {selectedClass.room_number ? ` · Room ${selectedClass.room_number}` : ""}
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedTeacherId ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {t("selectPrompt")}
        </div>
      ) : loadingAttendance ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <Card className="border-gray-200">
              <CardContent className="py-3 px-2 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("total")}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-3 px-2 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                <p className="text-xs text-green-700">{t("present")}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-3 px-2 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                <p className="text-xs text-red-700">{t("absent")}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="py-3 px-2 text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
                <p className="text-xs text-yellow-700">{t("late")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("studentColumn")}</th>
                  <th className="px-4 py-3 font-semibold">{t("idColumn")}</th>
                  <th className="px-4 py-3 font-semibold text-center">{t("absentColumn")}</th>
                  <th className="px-4 py-3 font-semibold text-center">{t("presentColumn")}</th>
                  <th className="px-4 py-3 font-semibold text-center">{t("tardyColumn")}</th>
                  <th className="px-4 py-3 font-semibold">{t("commentColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendanceData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {t("noStudents")}
                    </td>
                  </tr>
                ) : (
                  attendanceData.map((student, index) => (
                    <tr key={student.student_id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{student.student_name}</div>
                        <div className="text-xs text-muted-foreground">#{index + 1}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{student.student_number}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name={`status-${student.student_id}`}
                          checked={student.status === "absent"}
                          onChange={() => setStatus(student.student_id, "absent")}
                          className="h-4 w-4 text-red-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name={`status-${student.student_id}`}
                          checked={student.status === "present"}
                          onChange={() => setStatus(student.student_id, "present")}
                          className="h-4 w-4 text-green-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="radio"
                          name={`status-${student.student_id}`}
                          checked={student.status === "late"}
                          onChange={() => setStatus(student.student_id, "late")}
                          className="h-4 w-4 text-yellow-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={student.remarks ?? ""}
                          onChange={(e) => updateRemarks(student.student_id, e.target.value)}
                          placeholder={t("commentPlaceholder")}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg md:max-w-4xl md:mx-auto md:left-auto md:right-auto md:rounded-t-xl">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || !selectedClassId}
              className="w-full h-12 text-lg font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> {t("saving")}
                </>
              ) : hasChanges ? (
                <>
                  <Save className="h-5 w-5 mr-2" /> {t("saveWithCounts", { present: stats.present, absent: stats.absent })}
                </>
              ) : (
                <>
                  <Badge className="mr-2 bg-green-100 text-green-700">{t("saved")}</Badge> {t("noChanges")}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
