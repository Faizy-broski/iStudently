"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, BookOpen, User, Loader2 } from "lucide-react";
import { GlobalPeriod, DayOfWeek } from "@/lib/api/teachers";
import * as timetableApi from "@/lib/api/timetable";
import * as academicsApi from "@/lib/api/academics";
import * as coursesApi from "@/lib/api/courses";
import * as teachersApi from "@/lib/api/teachers";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { formatTimeRange } from "@/lib/utils/formatTime";

const DAY_MAP: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4
};

interface AssignSlotDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sectionId: string;
    sectionName: string;
    day: string;
    period: GlobalPeriod;
    academicYearId: string;
    existingEntry?: timetableApi.TimetableEntry;
    onSave: () => void;
}

import { useTranslations } from "next-intl";

export function AssignSlotDialog({
    open,
    onOpenChange,
    sectionId,
    sectionName,
    day,
    period,
    academicYearId,
    existingEntry,
    onSave
}: AssignSlotDialogProps) {
    const t = useTranslations('school.timetable')
    const daysT = useTranslations('school.timetable.days')

    const [selectedCpId, setSelectedCpId] = useState("");
    const [roomNumber, setRoomNumber] = useState("");
    const [conflictWarning, setConflictWarning] = useState("");
    // Room double-booking, from the schedule decision service (POST /timetable/validate-change)
    const [roomConflict, setRoomConflict] = useState<timetableApi.ScheduleChangeDecision | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    const campusContext = useCampus();
    const selectedCampus = campusContext?.selectedCampus;

    const [coursePeriods, setCoursePeriods] = useState<coursesApi.CoursePeriod[]>([]);
    const [section, setSection] = useState<academicsApi.Section | null>(null);

    const selectedCp = coursePeriods.find(cp => cp.id === selectedCpId) || null;

    // Direct subject + teacher choice, for when no course period exists (or the admin
    // simply doesn't want to go through one). A course period, when picked, wins.
    const [subjects, setSubjects] = useState<academicsApi.Subject[]>([]);
    const [teachers, setTeachers] = useState<teachersApi.Staff[]>([]);
    const [manualSubjectId, setManualSubjectId] = useState("");
    const [manualTeacherId, setManualTeacherId] = useState("");
    const effectiveTeacherId = selectedCp?.teacher_id || manualTeacherId;
    const effectiveSubjectId = selectedCp?.course?.subject?.id || manualSubjectId;

    useEffect(() => {
        if (open) {
            loadData();
            if (existingEntry) {
                // Try to find matching CP by teacher + subject
                setRoomNumber(existingEntry.room_number || "");
            } else {
                setSelectedCpId("");
                setRoomNumber("");
                setManualSubjectId("");
                setManualTeacherId("");
            }
            setConflictWarning("");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, existingEntry]);

    const loadData = async () => {
        setLoadingData(true);
        try {
            const [sectionRes, cpData] = await Promise.all([
                academicsApi.getSectionById(sectionId).catch(() => ({ data: null })),
                coursesApi.getSectionCoursePeriods(sectionId, academicYearId).catch(() => [])
            ]);
            setSection(sectionRes.data || null);
            setCoursePeriods(cpData);

            const gradeId = sectionRes.data?.grade_level_id;
            const [subjectsRes, teachersRes] = await Promise.all([
                academicsApi.getSubjects(gradeId, selectedCampus?.id).catch(() => null),
                teachersApi.getAllTeachers({ page: 1, limit: 500, campus_id: selectedCampus?.id }).catch(() => null),
            ]);
            setSubjects((subjectsRes?.data || []).filter((sub) => sub.is_active));
            setTeachers(teachersRes?.data || []);
            if (existingEntry) {
                setManualSubjectId(existingEntry.subject_id || "");
                setManualTeacherId(existingEntry.teacher_id || "");
            }

            // Pre-select if editing and only one CP matches
            if (existingEntry && cpData.length > 0) {
                const match = cpData.find(
                    cp => cp.teacher_id === existingEntry.teacher_id
                );
                if (match) setSelectedCpId(match.id);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
            setCoursePeriods([]);
        } finally {
            setLoadingData(false);
        }
    };

    // Conflict check whenever CP selection changes
    useEffect(() => {
        const checkConflict = async () => {
            if (!effectiveTeacherId) {
                setConflictWarning("");
                return;
            }
            try {
                const dayNumber = DAY_MAP[day] as timetableApi.DayOfWeek;
                const conflict = await timetableApi.checkTeacherConflict(
                    effectiveTeacherId,
                    dayNumber,
                    period.id,
                    academicYearId,
                    existingEntry?.id
                );
                setConflictWarning(conflict.has_conflict ? `⚠️ ${conflict.conflict_details}` : "");
            } catch {
                // ignore
            }
        };
        checkConflict();
    }, [selectedCpId, manualTeacherId, day, period.id, academicYearId, existingEntry]); // eslint-disable-line react-hooks/exhaustive-deps

    // Room conflict check — re-runs when the teacher/room/slot changes. A failed
    // check is ignored here; the server re-checks on save and will still reject.
    const effectiveRoom = (roomNumber || selectedCp?.room || "").trim();
    useEffect(() => {
        if (!effectiveTeacherId || !effectiveRoom) {
            setRoomConflict(null);
            return;
        }
        let cancelled = false;
        timetableApi.validateScheduleChange({
            academicYearId,
            teacherId: effectiveTeacherId,
            roomNumber: effectiveRoom,
            dayOfWeek: DAY_MAP[day] as timetableApi.DayOfWeek,
            periodId: period.id,
            campusId: selectedCampus?.id,
            excludeEntryId: existingEntry?.id
        })
            .then((decision) => {
                if (cancelled) return;
                const roomClash = decision.conflictType === 'room_double_booked' || decision.conflictType === 'both';
                setRoomConflict(roomClash ? decision : null);
            })
            .catch(() => { if (!cancelled) setRoomConflict(null); });
        return () => { cancelled = true; };
    }, [selectedCpId, manualTeacherId, effectiveRoom, day, period.id, academicYearId, existingEntry, selectedCampus?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const getCpLabel = (cp: coursesApi.CoursePeriod) => {
        const course = cp.course?.title || cp.title || t('label_untitled');
        const teacher = cp.teacher?.profile
            ? `${cp.teacher.profile.first_name || ''} ${cp.teacher.profile.last_name || ''}`.trim()
            : t('label_no_teacher');
        return `${course} — ${teacher}`;
    };

    const handleSave = async () => {
        if (!selectedCp && !(manualSubjectId && manualTeacherId)) {
            toast.error(t('err_select_cp'));
            return;
        }

        setLoading(true);
        try {
            const dayNumber = DAY_MAP[day];
            const subjectId = effectiveSubjectId;
            const teacherId = effectiveTeacherId;
            const room = roomNumber || selectedCp?.room || undefined;

            if (!subjectId || !teacherId) {
                toast.error(t('err_missing_data'));
                return;
            }

            if (existingEntry) {
                await timetableApi.updateTimetableEntry(existingEntry.id, {
                    subject_id: subjectId,
                    teacher_id: teacherId,
                    room_number: room
                });
            } else {
                await timetableApi.createTimetableEntry({
                    section_id: sectionId,
                    subject_id: subjectId,
                    teacher_id: teacherId,
                    period_id: period.id,
                    day_of_week: dayNumber as DayOfWeek,
                    academic_year_id: academicYearId,
                    room_number: room,
                    campus_id: selectedCampus?.id
                });
            }

            toast.success(existingEntry ? t('success_updated') : t('success_assigned'));
            onSave();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || t('err_save'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-[#57A3CC]" />
                        {existingEntry ? t('dialog_title_edit') : t('dialog_title_assign')} {section && `(${section.grade_name || t('label_grade')})`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Slot Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2 text-sm bg-muted/50 p-3 rounded-lg">
                        <div>
                            <span className="text-muted-foreground">{t('label_section')}:</span>
                            <span className="font-medium ml-1">{sectionName}</span>
                        </div>
                        {section && (
                            <div>
                                <span className="text-muted-foreground">{t('label_grade')}:</span>
                                <span className="font-medium ml-1">{section.grade_name}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-muted-foreground">{t('label_day')}:</span>
                            <span className="font-medium ml-1">{daysT(day)}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">{t('label_period')}:</span>
                            <span className="font-medium ml-1">
                                {period.title || period.short_name || `P${period.sort_order}`}
                            </span>
                        </div>
                        {(period.start_time || period.end_time) && (
                            <div>
                                <span className="text-muted-foreground">{t('label_time')}:</span>
                                <span className="font-medium ml-1">{formatTimeRange(period.start_time, period.end_time)}</span>
                            </div>
                        )}
                    </div>

                    {(conflictWarning || roomConflict) && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {conflictWarning && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{conflictWarning}</AlertDescription>
                                </Alert>
                            )}

                            {roomConflict && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="space-y-2">
                                        <p>{roomConflict.conflictReason}</p>
                                        {roomConflict.suggestedAlternativeRoom && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="bg-white text-foreground"
                                                onClick={() => setRoomNumber(roomConflict.suggestedAlternativeRoom!)}
                                            >
                                                {t('btn_use_suggested_room', { room: roomConflict.suggestedAlternativeRoom })}
                                            </Button>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    {loadingData ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-4">
                                {/* Course Period Selection */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>{t('label_course_period')} *</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {t('label_available', { count: coursePeriods.length })}
                                        </span>
                                    </div>
                                    <Select value={selectedCpId} onValueChange={setSelectedCpId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('placeholder_course_period')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {coursePeriods.length === 0 ? (
                                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                                    {t('no_course_periods')}
                                                </div>
                                            ) : (
                                                coursePeriods.map(cp => (
                                                    <SelectItem key={cp.id} value={cp.id}>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span>{getCpLabel(cp)}</span>
                                                            {cp.course?.subject && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {t('label_subject')}: {cp.course.subject.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Direct subject + teacher choice (used when no course period is picked) */}
                                {!selectedCp && (
                                    <div className="space-y-3 rounded-lg border border-dashed p-3">
                                        <p className="text-xs text-muted-foreground">
                                            {coursePeriods.length === 0 ? t('direct_hint_none') : t('direct_hint')}
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                                            <div className="space-y-1.5">
                                                <Label>{t('label_subject')} *</Label>
                                                <Select value={manualSubjectId} onValueChange={setManualSubjectId}>
                                                    <SelectTrigger><SelectValue placeholder={t('placeholder_subject')} /></SelectTrigger>
                                                    <SelectContent>
                                                        {subjects.length === 0 ? (
                                                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">{t('no_subjects_for_grade')}</div>
                                                        ) : subjects.map((sub) => (
                                                            <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>{t('label_teacher')} *</Label>
                                                <Select value={manualTeacherId} onValueChange={setManualTeacherId}>
                                                    <SelectTrigger><SelectValue placeholder={t('placeholder_teacher')} /></SelectTrigger>
                                                    <SelectContent>
                                                        {teachers.map((tc) => (
                                                            <SelectItem key={tc.id} value={tc.id}>
                                                                {`${tc.profile?.first_name || ''} ${tc.profile?.last_name || ''}`.trim() || tc.employee_number}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {/* Auto-filled info from selected CP */}
                                {selectedCp && (
                                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                                        {selectedCp.course?.subject && (
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-muted-foreground">{t('label_subject')}:</span>
                                                <span className="font-medium">{selectedCp.course.subject.name}</span>
                                                {selectedCp.course.subject.code && (
                                                    <Badge variant="outline" className="text-xs">{selectedCp.course.subject.code}</Badge>
                                                )}
                                            </div>
                                        )}
                                        {selectedCp.teacher?.profile && (
                                            <div className="flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-muted-foreground">{t('label_teacher')}:</span>
                                                <span className="font-medium">
                                                    {`${selectedCp.teacher.profile.first_name || ''} ${selectedCp.teacher.profile.last_name || ''}`.trim()}
                                                </span>
                                            </div>
                                        )}
                                        {selectedCp.room && (
                                            <div className="text-muted-foreground text-xs">
                                                {t('label_default_room')}: {selectedCp.room}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Room override */}
                                <div className="space-y-2">
                                    <Label>{t('label_room_number')} {selectedCp?.room ? t('label_override') : t('label_optional')}</Label>
                                    <Input
                                        value={roomNumber}
                                        onChange={(e) => setRoomNumber(e.target.value)}
                                        placeholder={selectedCp?.room || t('placeholder_room')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {t('btn_cancel')}
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!(selectedCp || (manualSubjectId && manualTeacherId)) || !!conflictWarning || !!roomConflict || loading || loadingData}
                            className="bg-[#022172] hover:bg-[#022172]/90"
                        >
                            {loading ? t('btn_saving') : (existingEntry ? t('btn_update') : t('btn_assign'))}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
