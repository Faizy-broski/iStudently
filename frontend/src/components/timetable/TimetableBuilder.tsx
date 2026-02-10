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
    Eraser
} from "lucide-react";
import { TimetableEntry, DayOfWeek } from "@/lib/api/timetable";
import { GlobalPeriod, Staff } from "@/lib/api/teachers";
import * as timetableApi from "@/lib/api/timetable";
import * as academicsApi from "@/lib/api/academics";
import * as teachersApi from "@/lib/api/teachers";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";

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
    onEntriesChange: () => void;
}

// Helper functions for period display
const getPeriodShortLabel = (period: GlobalPeriod): string => {
    return period.short_name || `P${period.sort_order}`;
};

const getPeriodDurationInfo = (period: GlobalPeriod): string => {
    if (period.length_minutes) {
        return `${period.length_minutes}min`;
    }
    return '';
};

export function TimetableBuilder({
    sectionId,
    sectionName,
    gradeName,
    gradeId,
    periods,
    entries,
    academicYearId,
    isLoading = false,
    onEntriesChange
}: TimetableBuilderProps) {
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
            toast.error('Failed to load subjects and teachers');
        } finally {
            setLoadingData(false);
        }
    }, [gradeId, selectedCampus?.id]);

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

    // Handle save from dialog
    const handleDialogSave = async () => {
        if (!selectedSlot) return;

        if (!selectedSubject) {
            toast.error("Please select a subject");
            return;
        }
        if (!selectedTeacher) {
            toast.error("Please select a teacher");
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

            toast.success(selectedSlot.existingEntry ? "Entry updated" : "Class assigned");
            onEntriesChange();
            setDialogOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    // Handle erase entry
    const handleEraseEntry = async (entry: TimetableEntry) => {
        try {
            await timetableApi.deleteTimetableEntry(entry.id);
            toast.success('Entry removed');
            onEntriesChange();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove entry';
            toast.error(message);
        }
    };

    // Copy day's schedule to another day
    const copyDaySchedule = async (fromDay: string, toDay: string) => {
        const fromDayNumber = DAY_MAP[fromDay];
        const toDayNumber = DAY_MAP[toDay];
        
        const dayEntries = entries.filter(e => e.day_of_week === fromDayNumber);
        
        if (dayEntries.length === 0) {
            toast.error(`No entries found for ${fromDay}`);
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

            toast.success(`Copied ${successCount} entries. Skipped ${skipCount} (conflicts/existing).`);
            onEntriesChange();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to copy schedule';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    // Clear all entries for a day
    const clearDay = async (day: string) => {
        const dayNumber = DAY_MAP[day];
        const dayEntries = entries.filter(e => e.day_of_week === dayNumber);
        
        if (dayEntries.length === 0) {
            toast.info(`No entries to clear for ${day}`);
            return;
        }

        if (!confirm(`Clear all ${dayEntries.length} entries for ${day}?`)) {
            return;
        }

        setSaving(true);
        try {
            for (const entry of dayEntries) {
                await timetableApi.deleteTimetableEntry(entry.id);
            }
            toast.success(`Cleared ${dayEntries.length} entries`);
            onEntriesChange();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to clear day';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    // Get teacher name helper
    const getTeacherName = (teacher: Staff): string => {
        if (teacher.profile) {
            return `${teacher.profile.first_name || ''} ${teacher.profile.last_name || ''}`.trim();
        }
        return 'Unknown';
    };

    // Get display info for a slot
    const getSlotDisplayInfo = (entry: TimetableEntry): { subjectName: string; teacherName: string } => {
        return {
            subjectName: entry.subject_name || subjects.find(s => s.id === entry.subject_id)?.name || 'Subject',
            teacherName: entry.teacher_name || teachers.find(t => t.id === entry.teacher_id)?.profile?.first_name || 'Teacher'
        };
    };

    if (isLoading || loadingData) {
        return (
            <Card>
                <CardContent className="py-12 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading timetable builder...</span>
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
                            • {entries.length} classes assigned
                        </span>
                    </CardTitle>

                    {/* Erase Mode Toggle */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={eraseMode ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => setEraseMode(!eraseMode)}
                        >
                            <Eraser className="h-4 w-4 mr-1" />
                            {eraseMode ? 'Exit Erase Mode' : 'Erase Mode'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4">
                {eraseMode && (
                    <Alert className="mb-4 bg-red-50 border-red-200">
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            Erase mode active. Click on any assigned slot to remove it.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Timetable Grid */}
                <TooltipProvider>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    <th className="border p-2 bg-muted/50 font-medium min-w-[60px]">
                                        Period
                                    </th>
                                    {DAYS.map(day => (
                                        <th key={day} className="border p-2 bg-muted/50 font-medium min-w-[120px]">
                                            <div className="flex items-center justify-between">
                                                <span>{day}</span>
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
                                                        <TooltipContent>Copy to next day</TooltipContent>
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
                                                        <TooltipContent>Clear day</TooltipContent>
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
                                            <div className="text-xs text-muted-foreground">
                                                {getPeriodDurationInfo(period)}
                                            </div>
                                        </td>
                                        {DAYS.map(day => {
                                            const entry = getEntryForSlot(day, period.id);

                                            return (
                                                <td
                                                    key={`${day}-${period.id}`}
                                                    className={`border p-2 cursor-pointer transition-all duration-150 ${
                                                        entry
                                                            ? eraseMode
                                                                ? 'bg-red-50 hover:bg-red-100 border-red-200'
                                                                : 'bg-blue-50 hover:bg-blue-100'
                                                            : 'hover:bg-muted/50'
                                                    }`}
                                                    onClick={() => handleSlotClick(day, period)}
                                                >
                                                    {entry ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="relative group min-h-[40px]">
                                                                    <div className="font-medium text-[#022172] truncate">
                                                                        {getSlotDisplayInfo(entry).subjectName}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                        <User className="h-3 w-3 flex-shrink-0" />
                                                                        {getSlotDisplayInfo(entry).teacherName}
                                                                    </div>
                                                                    {entry.room_number && (
                                                                        <div className="text-xs text-muted-foreground">
                                                                            📍 {entry.room_number}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-sm">
                                                                    <div><strong>{getSlotDisplayInfo(entry).subjectName}</strong></div>
                                                                    <div>Teacher: {getSlotDisplayInfo(entry).teacherName}</div>
                                                                    {entry.room_number && <div>Room: {entry.room_number}</div>}
                                                                    <div className="text-xs text-muted-foreground mt-1">Click to edit</div>
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
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TooltipProvider>

                {/* Quick Stats */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div>
                        <span className="font-medium text-foreground">{entries.length}</span> classes assigned
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{sortedPeriods.length * DAYS.length - entries.length}</span> empty slots
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{new Set(entries.map(e => e.subject_id)).size}</span> subjects
                    </div>
                    <div>
                        <span className="font-medium text-foreground">{new Set(entries.map(e => e.teacher_id)).size}</span> teachers
                    </div>
                </div>
            </CardContent>

            {/* Assign Slot Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-[#57A3CC]" />
                            {selectedSlot?.existingEntry ? 'Edit Class' : 'Assign Class'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Slot Info */}
                        {selectedSlot && (
                            <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                                <div>
                                    <span className="text-muted-foreground">Section:</span>
                                    <span className="font-medium ml-1">{sectionName}</span>
                                </div>
                                {gradeName && (
                                    <div>
                                        <span className="text-muted-foreground">Grade:</span>
                                        <span className="font-medium ml-1">{gradeName}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-muted-foreground">Day:</span>
                                    <span className="font-medium ml-1">{selectedSlot.day}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Period:</span>
                                    <span className="font-medium ml-1">
                                        {selectedSlot.period.title || selectedSlot.period.short_name || `P${selectedSlot.period.sort_order}`}
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
                            <Label>Subject *</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                            No subjects available
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
                            <Label>Teacher *</Label>
                            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select teacher" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers.length === 0 ? (
                                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                            No teachers available
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
                            <Label>Room Number (Optional)</Label>
                            <Input
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                placeholder="e.g., Lab-1, Room-201"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleDialogSave}
                                disabled={!selectedSubject || !selectedTeacher || !!conflictWarning || saving}
                                className="bg-[#022172] hover:bg-[#022172]/90"
                            >
                                {saving ? "Saving..." : (selectedSlot?.existingEntry ? "Update" : "Assign")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
