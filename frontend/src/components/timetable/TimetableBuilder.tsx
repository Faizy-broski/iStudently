"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Plus,
    User,
    Loader2,
    BookOpen,
    Copy,
    Trash2,
    AlertCircle,
    Eraser,
    Lock,
    Unlock,
    Sparkles
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { TimetableEntry, DayOfWeek } from "@/lib/api/timetable";
import { GlobalPeriod, Staff } from "@/lib/api/teachers";
import * as timetableApi from "@/lib/api/timetable";
import * as academicsApi from "@/lib/api/academics";
import * as teachersApi from "@/lib/api/teachers";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { formatTime, formatTimeRange } from "@/lib/utils/formatTime";
import { useTranslations } from "next-intl";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_MAP: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4
};

interface Subject {
    id: string;
    name: string;
    code?: string;
}

interface TimetableBuilderProps {
    sectionId: string;
    sectionName: string;
    gradeName?: string;
    gradeId?: string;
    periods: GlobalPeriod[];
    entries: TimetableEntry[];
    academicYearId: string;
    isLoading?: boolean;
    orientation?: 'vertical' | 'horizontal';
    onEntriesChange: () => void;
}

export function TimetableBuilder({
    sectionId,
    sectionName,
    gradeName,
    gradeId,
    periods,
    entries,
    academicYearId,
    isLoading = false,
    orientation = 'vertical',
    onEntriesChange
}: TimetableBuilderProps) {
    const t = useTranslations('school.timetable')
    const daysT = useTranslations('school.timetable.days')

    // Campus context
    const campusContext = useCampus();
    const selectedCampus = campusContext?.selectedCampus;

    // Data state - loaded once for the section
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Staff[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Dialog state for assigning slots
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{
        day: string;
        period: GlobalPeriod;
        existingEntry?: TimetableEntry;
    } | null>(null);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [roomNumber, setRoomNumber] = useState("");
    const [conflictWarning, setConflictWarning] = useState("");

    // Erase mode state
    const [eraseMode, setEraseMode] = useState(false);

    // Operation state
    const [saving, setSaving] = useState(false);

    // Lock/unlock state — optimistic overrides keyed by entry id, cleared once
    // the parent's `entries` prop reflects the server state after refetch.
    const [lockOverrides, setLockOverrides] = useState<Record<string, boolean>>({});
    const [lockingEntryId, setLockingEntryId] = useState<string | null>(null);
    const [bulkLocking, setBulkLocking] = useState(false);

    // Keyboard navigation: map of "day::periodId" -> cell element
    const cellRefs = React.useRef<Map<string, HTMLTableCellElement>>(new Map());

    // Helper functions for period display
    const getPeriodShortLabel = (period: GlobalPeriod): string => {
        return period.short_name || `P${period.sort_order}`;
    };

    const getPeriodTimeInfo = (period: GlobalPeriod): string => {
        const timeRange = formatTimeRange(period.start_time, period.end_time);
        if (timeRange) return timeRange;
        if (period.length_minutes) return `${period.length_minutes}${t('unit_min')}`;
        return '';
    };

    // Load subjects and teachers
    const loadSectionData = useCallback(async () => {
        setLoadingData(true);
        try {
            const [subjectsRes, teachersRes] = await Promise.all([
                academicsApi.getSubjects(gradeId, selectedCampus?.id).catch(() => ({ data: [] })),
                teachersApi.getAllTeachers({ page: 1, limit: 200, campus_id: selectedCampus?.id }).catch(() => ({ data: [] }))
            ]);
            setSubjects(subjectsRes.data || []);
            setTeachers(teachersRes.data || []);
        } catch (error) {
            console.error('Failed to load section data:', error);
            toast.error(t('err_load_academics'));
        } finally {
            setLoadingData(false);
        }
    }, [gradeId, selectedCampus?.id, t]);

    // Load subjects and teachers once when component mounts or section changes
    useEffect(() => {
        loadSectionData();
    }, [sectionId, loadSectionData]);

    // Sort periods by sort_order
    const sortedPeriods = useMemo(() => 
        [...periods].sort((a, b) => a.sort_order - b.sort_order),
        [periods]
    );

    // Get entry for a specific slot
    const getEntryForSlot = useCallback((day: string, periodId: string): TimetableEntry | undefined => {
        const dayNumber = DAY_MAP[day];
        return entries.find(e => e.day_of_week === dayNumber && e.period_id === periodId);
    }, [entries]);

    // Clear stale optimistic overrides once fresh data arrives from the parent
    useEffect(() => {
        setLockOverrides({});
    }, [entries]);

    const isEntryLocked = useCallback((entry: TimetableEntry): boolean => {
        if (entry.id in lockOverrides) return lockOverrides[entry.id];
        return !!entry.locked;
    }, [lockOverrides]);

    // Toggle lock on a single cell — optimistic UI update + toast, reverts on failure
    const handleToggleLock = useCallback(async (entry: TimetableEntry, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const nextLocked = !isEntryLocked(entry);
        setLockOverrides(prev => ({ ...prev, [entry.id]: nextLocked }));
        setLockingEntryId(entry.id);
        try {
            await timetableApi.lockTimetableEntry(entry.id, nextLocked);
            toast.success(nextLocked ? 'Cell locked' : 'Cell unlocked');
            onEntriesChange();
        } catch (error: any) {
            setLockOverrides(prev => ({ ...prev, [entry.id]: !nextLocked }));
            toast.error(error.message || 'Failed to update lock state');
        } finally {
            setLockingEntryId(null);
        }
    }, [isEntryLocked, onEntriesChange]);

    // Bulk lock/unlock every entry currently in this section's grid
    const handleBulkLock = useCallback(async (locked: boolean) => {
        setBulkLocking(true);
        try {
            const result = await timetableApi.bulkLockTimetableEntries({ section_id: sectionId, locked });
            toast.success(`${locked ? 'Locked' : 'Unlocked'} ${result.updated_count} cell${result.updated_count === 1 ? '' : 's'}`);
            onEntriesChange();
        } catch (error: any) {
            toast.error(error.message || 'Failed to bulk update lock state');
        } finally {
            setBulkLocking(false);
        }
    }, [sectionId, onEntriesChange]);

    // Check for conflicts when teacher changes in dialog
    useEffect(() => {
        const checkConflict = async () => {
            if (!selectedTeacher || !selectedSlot) {
                setConflictWarning("");
                return;
            }

            try {
                const dayNumber = DAY_MAP[selectedSlot.day] as DayOfWeek;
                const conflict = await timetableApi.checkTeacherConflict(
                    selectedTeacher,
                    dayNumber,
                    selectedSlot.period.id,
                    academicYearId,
                    selectedSlot.existingEntry?.id
                );

                if (conflict.has_conflict) {
                    setConflictWarning(`⚠️ ${conflict.conflict_details}`);
                } else {
                    setConflictWarning("");
                }
            } catch (error) {
                console.error('Conflict check failed:', error);
            }
        };

        checkConflict();
    }, [selectedTeacher, selectedSlot, academicYearId]);

    // Handle slot click - open dialog for both new and existing entries
    const handleSlotClick = (day: string, period: GlobalPeriod) => {
        const existingEntry = getEntryForSlot(day, period.id);

        if (existingEntry && isEntryLocked(existingEntry)) {
            toast.info('This cell is locked. Unlock it first to edit.');
            return;
        }

        if (eraseMode) {
            // In erase mode, delete the entry directly
            if (existingEntry) {
                handleEraseEntry(existingEntry);
            }
            return;
        }

        // Open dialog for assigning/editing
        setSelectedSlot({ day, period, existingEntry });
        if (existingEntry) {
            setSelectedSubject(existingEntry.subject_id);
            setSelectedTeacher(existingEntry.teacher_id);
            setRoomNumber(existingEntry.room_number || "");
        } else {
            setSelectedSubject("");
            setSelectedTeacher("");
            setRoomNumber("");
        }
        setConflictWarning("");
        setDialogOpen(true);
    };

    // Keyboard navigation across the grid (arrow keys move focus between
    // cells; Enter/Space activates the same click handler). Defined as a
    // plain function (not memoized) so it always closes over the latest
    // `eraseMode`/`orientation` state without needing a large dependency list.
    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>, day: string, period: GlobalPeriod) => {
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!arrowKeys.includes(e.key)) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSlotClick(day, period);
            }
            return;
        }
        e.preventDefault();

        const dayIdx = DAYS.indexOf(day);
        const periodIdx = sortedPeriods.findIndex(p => p.id === period.id);

        let nextDayIdx = dayIdx;
        let nextPeriodIdx = periodIdx;

        // Vertical: periods are rows, days are columns. Horizontal: days are
        // rows, periods are columns — swap which arrow moves which axis.
        const moveAcrossDays = (orientation === 'vertical' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
            (orientation === 'horizontal' && (e.key === 'ArrowUp' || e.key === 'ArrowDown'));

        if (moveAcrossDays) {
            const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
            nextDayIdx = Math.min(Math.max(dayIdx + delta, 0), DAYS.length - 1);
        } else {
            const delta = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
            nextPeriodIdx = Math.min(Math.max(periodIdx + delta, 0), sortedPeriods.length - 1);
        }

        const nextDay = DAYS[nextDayIdx];
        const nextPeriod = sortedPeriods[nextPeriodIdx];
        if (nextDay && nextPeriod) {
            const key = `${nextDay}::${nextPeriod.id}`;
            cellRefs.current.get(key)?.focus();
        }
    };

    // Handle save from dialog
    const handleDialogSave = async () => {
        if (!selectedSlot) return;

        if (!selectedSubject) {
            toast.error(t('err_select_subject'));
            return;
        }
        if (!selectedTeacher) {
            toast.error(t('err_select_teacher'));
            return;
        }

        setSaving(true);
        try {
            const dayNumber = DAY_MAP[selectedSlot.day];

            if (selectedSlot.existingEntry) {
                await timetableApi.updateTimetableEntry(selectedSlot.existingEntry.id, {
                    subject_id: selectedSubject,
                    teacher_id: selectedTeacher,
                    room_number: roomNumber || undefined
                });
            } else {
                await timetableApi.createTimetableEntry({
                    section_id: sectionId,
                    subject_id: selectedSubject,
                    teacher_id: selectedTeacher,
                    period_id: selectedSlot.period.id,
                    day_of_week: dayNumber as DayOfWeek,
                    academic_year_id: academicYearId,
                    room_number: roomNumber || undefined,
                    campus_id: selectedCampus?.id
                });
            }

            toast.success(selectedSlot.existingEntry ? t('success_updated') : t('success_assigned'));
            onEntriesChange();
            setDialogOpen(false);
        } catch (error: any) {
            toast.error(error.message || t('err_save'));
        } finally {
            setSaving(false);
        }
    };

    // Handle erase entry
    const handleEraseEntry = async (entry: TimetableEntry) => {
        try {
            await timetableApi.deleteTimetableEntry(entry.id);
            toast.success(t('success_removed_entry'));
            onEntriesChange();
        } catch (error) {
            toast.error(t('err_remove_entry'));
        }
    };

    // Copy day's schedule to another day
    const copyDaySchedule = async (fromDay: string, toDay: string) => {
        const fromDayNumber = DAY_MAP[fromDay];
        const toDayNumber = DAY_MAP[toDay];
        
        const dayEntries = entries.filter(e => e.day_of_week === fromDayNumber);
        
        if (dayEntries.length === 0) {
            toast.error(t('err_no_entries_day', { day: daysT(fromDay) }));
            return;
        }

        setSaving(true);
        try {
            let successCount = 0;
            let skipCount = 0;

            for (const entry of dayEntries) {
                // Check if target slot already has an entry
                const existingTarget = entries.find(
                    e => e.day_of_week === toDayNumber && e.period_id === entry.period_id
                );

                if (existingTarget) {
                    skipCount++;
                    continue;
                }

                // Check for teacher conflict
                const conflict = await timetableApi.checkTeacherConflict(
                    entry.teacher_id,
                    toDayNumber as DayOfWeek,
                    entry.period_id,
                    academicYearId
                );

                if (conflict.has_conflict) {
                    skipCount++;
                    continue;
                }

                await timetableApi.createTimetableEntry({
                    section_id: sectionId,
                    subject_id: entry.subject_id,
                    teacher_id: entry.teacher_id,
                    period_id: entry.period_id,
                    day_of_week: toDayNumber as DayOfWeek,
                    academic_year_id: academicYearId,
                    room_number: entry.room_number || undefined,
                    campus_id: selectedCampus?.id
                });
                successCount++;
            }

            toast.success(t('success_copy', { successCount, skipCount }));
            onEntriesChange();
        } catch (error) {
            toast.error(t('err_copy'));
        } finally {
            setSaving(false);
        }
    };

    // Clear all entries for a day
    const clearDay = async (day: string) => {
        const dayNumber = DAY_MAP[day];
        const dayEntries = entries.filter(e => e.day_of_week === dayNumber);
        
        if (dayEntries.length === 0) {
            toast.info(t('info_nothing_to_clear', { day: daysT(day) }));
            return;
        }

        if (!confirm(t('confirm_clear_day', { count: dayEntries.length, day: daysT(day) }))) {
            return;
        }

        setSaving(true);
        try {
            for (const entry of dayEntries) {
                await timetableApi.deleteTimetableEntry(entry.id);
            }
            toast.success(t('success_cleared_day', { count: dayEntries.length }));
            onEntriesChange();
        } catch (error) {
            toast.error(t('err_clear_day'));
        } finally {
            setSaving(false);
        }
    };

    // Get teacher name helper
    const getTeacherName = (teacher: Staff): string => {
        if (teacher.profile) {
            return `${teacher.profile.first_name || ''} ${teacher.profile.last_name || ''}`.trim();
        }
        return t('label_unknown');
    };

    // Get display info for a slot
    const getSlotDisplayInfo = (entry: TimetableEntry): { subjectName: string; teacherName: string } => {
        return {
            subjectName: entry.subject_name || subjects.find(s => s.id === entry.subject_id)?.name || t('label_subject'),
            teacherName: entry.teacher_name || teachers.find(t => t.id === entry.teacher_id)?.profile?.first_name || t('label_teacher')
        };
    };

    // Render a builder slot cell (reused in both orientations)
    const renderBuilderSlot = (day: string, period: GlobalPeriod) => {
        const entry = getEntryForSlot(day, period.id);
        const locked = entry ? isEntryLocked(entry) : false;
        const isGenerated = !!entry?.generated_by_job_id;
        const cellKey = `${day}::${period.id}`;
        const ariaLabel = entry
            ? `${daysT(day)}, ${period.title || period.short_name}: ${getSlotDisplayInfo(entry).subjectName} with ${getSlotDisplayInfo(entry).teacherName}${locked ? ' (locked)' : ''}`
            : `${daysT(day)}, ${period.title || period.short_name}: empty slot`;

        return (
            <td
                key={cellKey}
                ref={(node) => {
                    if (node) cellRefs.current.set(cellKey, node);
                    else cellRefs.current.delete(cellKey);
                }}
                role="gridcell"
                tabIndex={0}
                aria-label={ariaLabel}
                onKeyDown={(e) => handleCellKeyDown(e, day, period)}
                className={`border p-2 cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#57A3CC] focus:ring-inset ${
                    entry
                        ? locked
                            ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                            : eraseMode
                                ? 'bg-red-50 hover:bg-red-100 border-red-200'
                                : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30'
                        : 'hover:bg-muted/50'
                }`}
                onClick={() => handleSlotClick(day, period)}
            >
                {entry ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative group min-h-[40px]">
                                <div className="flex items-center justify-between gap-1">
                                    <div className="font-medium text-[#022172] dark:text-blue-300 truncate">
                                        {getSlotDisplayInfo(entry).subjectName}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={locked ? 'Unlock this cell' : 'Lock this cell'}
                                        className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 disabled:opacity-30"
                                        disabled={lockingEntryId === entry.id}
                                        onClick={(e) => handleToggleLock(entry, e)}
                                    >
                                        {lockingEntryId === entry.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : locked ? (
                                            <Lock className="h-3 w-3 text-amber-600" />
                                        ) : (
                                            <Unlock className="h-3 w-3 text-muted-foreground" />
                                        )}
                                    </button>
                                </div>
                                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                    <User className="h-3 w-3 flex-shrink-0" />
                                    {getSlotDisplayInfo(entry).teacherName}
                                </div>
                                {entry.room_number && (
                                    <div className="text-xs text-muted-foreground">
                                        {entry.room_number}
                                    </div>
                                )}
                                {isGenerated && (
                                    <Badge variant="secondary" className="mt-1 text-[9px] px-1 py-0 h-4 gap-0.5 bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                        <Sparkles className="h-2.5 w-2.5" /> Generated
                                    </Badge>
                                )}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-sm">
                                <div><strong>{getSlotDisplayInfo(entry).subjectName}</strong></div>
                                <div>{t('tip_teacher', { name: getSlotDisplayInfo(entry).teacherName })}</div>
                                {entry.room_number && <div>{t('tip_room', { room: entry.room_number })}</div>}
                                {locked ? (
                                    <div className="text-xs text-amber-600 mt-1">Locked — unlock to edit</div>
                                ) : (
                                    <div className="text-xs text-muted-foreground mt-1">{t('tip_click_edit')}</div>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <div className="text-center py-2 min-h-[40px] flex items-center justify-center">
                        <Plus className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                )}
            </td>
        );
    };

    if (isLoading || loadingData) {
        return (
            <Card>
                <CardContent className="py-12 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">{t('loading_builder')}</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="py-3 border-b bg-muted/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Badge className="bg-[#022172]">{sectionName}</Badge>
                        {gradeName && <span className="text-sm text-muted-foreground font-normal">{gradeName}</span>}
                        <span className="text-sm text-muted-foreground font-normal">
                            • {t('classes_count', { count: entries.length })}
                        </span>
                    </CardTitle>

                    {/* Erase Mode Toggle + Bulk Lock */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" disabled={bulkLocking || entries.length === 0}>
                                    {bulkLocking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
                                    Lock All
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Lock all cells in {sectionName}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Every currently-assigned cell in this section's timetable will be locked and
                                        skipped by future automatic generations until individually unlocked.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleBulkLock(true)}>Lock All</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={bulkLocking || entries.length === 0}
                            onClick={() => handleBulkLock(false)}
                        >
                            {bulkLocking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlock className="h-4 w-4 mr-1" />}
                            Unlock All
                        </Button>
                        <Button
                            variant={eraseMode ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => setEraseMode(!eraseMode)}
                        >
                            <Eraser className="h-4 w-4 mr-1" />
                            {eraseMode ? t('btn_exit_erase') : t('btn_enter_erase')}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4">
                {eraseMode && (
                    <Alert className="mb-4 bg-red-50 border-red-200">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            {t('erase_active_desc')}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Timetable Grid */}
                <TooltipProvider>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm" role="grid" aria-label={`Timetable for ${sectionName}`}>
                            {orientation === 'vertical' ? (
                                /* Vertical: Periods as rows, Days as columns (default) */
                                <>
                                    <thead>
                                        <tr>
                                            <th className="border p-2 bg-muted/50 font-medium min-w-[80px]">
                                                {t('header_period_time')}
                                            </th>
                                            {DAYS.map(day => (
                                                <th key={day} className="border p-2 bg-muted/50 font-medium min-w-[120px]">
                                                    <div className="flex items-center justify-between">
                                                        <span>{daysT(day)}</span>
                                                        <div className="flex gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={() => {
                                                                            const nextDay = DAYS[(DAYS.indexOf(day) + 1) % DAYS.length];
                                                                            copyDaySchedule(day, nextDay);
                                                                        }}
                                                                        disabled={saving}
                                                                    >
                                                                        <Copy className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('tip_copy_next')}</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                                        onClick={() => clearDay(day)}
                                                                        disabled={saving}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('tip_clear_day')}</TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedPeriods.map(period => (
                                            <tr key={period.id}>
                                                <td className="border p-2 bg-muted/30 text-center">
                                                    <div className="font-medium">{getPeriodShortLabel(period)}</div>
                                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {getPeriodTimeInfo(period)}
                                                    </div>
                                                </td>
                                                {DAYS.map(day => renderBuilderSlot(day, period))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            ) : (
                                /* Horizontal: Days as rows, Periods as columns */
                                <>
                                    <thead>
                                        <tr>
                                            <th className="border p-2 bg-muted/50 font-medium min-w-[100px]">
                                                {t('label_day')}
                                            </th>
                                            {sortedPeriods.map(period => (
                                                <th key={period.id} className="border p-2 bg-muted/50 font-medium min-w-[100px]">
                                                    <div className="font-medium">{getPeriodShortLabel(period)}</div>
                                                    <div className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">
                                                        {getPeriodTimeInfo(period)}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS.map(day => (
                                            <tr key={day}>
                                                <td className="border p-2 bg-muted/30">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{daysT(day)}</span>
                                                        <div className="flex gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={() => {
                                                                            const nextDay = DAYS[(DAYS.indexOf(day) + 1) % DAYS.length];
                                                                            copyDaySchedule(day, nextDay);
                                                                        }}
                                                                        disabled={saving}
                                                                    >
                                                                        <Copy className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('tip_copy_next')}</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                                        onClick={() => clearDay(day)}
                                                                        disabled={saving}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{t('tip_clear_day')}</TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                </td>
                                                {sortedPeriods.map(period => renderBuilderSlot(day, period))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            )}
                        </table>
                    </div>
                </TooltipProvider>

                {/* Quick Stats */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div>
                        <span className="font-medium text-foreground">{t('classes_count', { count: entries.length })}</span>
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{t('empty_slots_count', { count: sortedPeriods.length * DAYS.length - entries.length })}</span>
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{t('subjects_count', { count: new Set(entries.map(e => e.subject_id)).size })}</span>
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{t('teachers_count', { count: new Set(entries.map(e => e.teacher_id)).size })}</span>
                    </div>
                </div>
            </CardContent>

            {/* Assign Slot Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-[#57A3CC]" />
                            {selectedSlot?.existingEntry ? t('dialog_title_edit_class') : t('dialog_title_assign')}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Slot Info */}
                        {selectedSlot && (
                            <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                                <div>
                                    <span className="text-muted-foreground">{t('label_section')}:</span>
                                    <span className="font-medium ml-1">{sectionName}</span>
                                </div>
                                {gradeName && (
                                    <div>
                                        <span className="text-muted-foreground">{t('label_grade')}:</span>
                                        <span className="font-medium ml-1">{gradeName}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-muted-foreground">{t('label_day')}:</span>
                                    <span className="font-medium ml-1">{daysT(selectedSlot.day)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">{t('label_period')}:</span>
                                    <span className="font-medium ml-1">
                                        {selectedSlot.period.title || selectedSlot.period.short_name || `P${selectedSlot.period.sort_order}`}
                                        {(selectedSlot.period.start_time || selectedSlot.period.end_time) && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({formatTimeRange(selectedSlot.period.start_time, selectedSlot.period.end_time)})
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        )}

                        {conflictWarning && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{conflictWarning}</AlertDescription>
                            </Alert>
                        )}

                        {/* Subject Selection */}
                        <div className="space-y-2">
                            <Label>{t('label_subject')} *</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('placeholder_subject')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                            {t('no_subjects')}
                                        </div>
                                    ) : (
                                        subjects.map(subject => (
                                            <SelectItem key={subject.id} value={subject.id}>
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="h-3 w-3" />
                                                    <span>{subject.name}</span>
                                                    {subject.code && <span className="text-muted-foreground">({subject.code})</span>}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Teacher Selection */}
                        <div className="space-y-2">
                            <Label>{t('label_teacher')} *</Label>
                            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('placeholder_teacher')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                            {t('no_teachers')}
                                        </div>
                                    ) : (
                                        teachers.map(teacher => (
                                            <SelectItem key={teacher.id} value={teacher.id}>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3" />
                                                    {getTeacherName(teacher)}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Room Number */}
                        <div className="space-y-2">
                            <Label>{t('label_room_number')} {t('label_optional_lower')}</Label>
                            <Input
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                placeholder={t('placeholder_room')}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {t('btn_cancel')}
                            </Button>
                            <Button
                                onClick={handleDialogSave}
                                disabled={!selectedSubject || !selectedTeacher || !!conflictWarning || saving}
                                className="bg-[#022172] hover:bg-[#022172]/90 text-white"
                            >
                                {saving ? t('btn_saving') : (selectedSlot?.existingEntry ? t('btn_update') : t('btn_assign'))}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
