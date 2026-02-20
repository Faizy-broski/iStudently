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
import { AlertCircle, BookOpen, User, Loader2 } from "lucide-react";
import { GlobalPeriod, Staff, DayOfWeek } from "@/lib/api/teachers";
import * as timetableApi from "@/lib/api/timetable";
import * as academicsApi from "@/lib/api/academics";
import * as teachersApi from "@/lib/api/teachers";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { formatTimeRange } from "@/lib/utils/formatTime";

const DAY_MAP: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4
};

interface Subject {
    id: string;
    name: string;
    code?: string;
    grade_name?: string;
}

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
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTeacher, setSelectedTeacher] = useState("");
    const [roomNumber, setRoomNumber] = useState("");
    const [conflictWarning, setConflictWarning] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    // Campus context for filtering
    const campusContext = useCampus();
    const selectedCampus = campusContext?.selectedCampus;

    // All available subjects and teachers
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Staff[]>([]);
    const [section, setSection] = useState<academicsApi.Section | null>(null);

    // Load subjects and teachers when dialog opens
    useEffect(() => {
        if (open) {
            loadData();
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
        }
    }, [open, existingEntry]);

    const loadData = async () => {
        setLoadingData(true);
        try {
            // Get section details first, with fallback
            let sectionData = null;
            let gradeId = null;

            try {
                const sectionRes = await academicsApi.getSectionById(sectionId);
                sectionData = sectionRes.data;
                gradeId = sectionData?.grade_level_id;
                setSection(sectionData || null);
            } catch (error) {
                console.warn('Could not load section details:', error);
            }

            // Load subjects and teachers in parallel
            const [subjectsRes, teachersRes] = await Promise.all([
                academicsApi.getSubjects(gradeId || undefined, selectedCampus?.id || undefined).catch(() => ({ data: [] })),
                teachersApi.getAllTeachers({ page: 1, limit: 100, campus_id: selectedCampus?.id }).catch(() => ({ data: [] }))
            ]);

            setSubjects(subjectsRes.data || []);
            setTeachers(teachersRes.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            // Set empty arrays on error to prevent infinite loading
            setSubjects([]);
            setTeachers([]);
        } finally {
            setLoadingData(false);
        }
    };

    // Check for conflicts when teacher changes
    useEffect(() => {
        const checkConflict = async () => {
            if (!selectedTeacher) {
                setConflictWarning("");
                return;
            }

            try {
                const dayNumber = DAY_MAP[day] as timetableApi.DayOfWeek;
                const conflict = await timetableApi.checkTeacherConflict(
                    selectedTeacher,
                    dayNumber,
                    period.id,
                    academicYearId,
                    existingEntry?.id
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
    }, [selectedTeacher, day, period.id, academicYearId, existingEntry]);

    const handleSave = async () => {
        if (!selectedSubject) {
            toast.error("Please select a subject");
            return;
        }
        if (!selectedTeacher) {
            toast.error("Please select a teacher");
            return;
        }

        setLoading(true);
        try {
            const dayNumber = DAY_MAP[day];

            if (existingEntry) {
                await timetableApi.updateTimetableEntry(existingEntry.id, {
                    subject_id: selectedSubject,
                    teacher_id: selectedTeacher,
                    room_number: roomNumber || undefined
                });
            } else {
                await timetableApi.createTimetableEntry({
                    section_id: sectionId,
                    subject_id: selectedSubject,
                    teacher_id: selectedTeacher,
                    period_id: period.id,
                    day_of_week: dayNumber as DayOfWeek,
                    academic_year_id: academicYearId,
                    room_number: roomNumber || undefined,
                    campus_id: selectedCampus?.id
                });
            }

            toast.success(existingEntry ? "Entry updated" : "Class assigned");
            onSave();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    };

    const getTeacherName = (teacher: Staff) => {
        if (teacher.profile) {
            return `${teacher.profile.first_name || ''} ${teacher.profile.last_name || ''}`;
        }
        return 'Unknown Teacher';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-[#57A3CC]" />
                        Assign Class {section && `(${section.grade_name || 'Grade'})`}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Slot Info */}
                    <div className="flex flex-wrap gap-4 text-sm bg-muted/50 p-3 rounded-lg">
                        <div>
                            <span className="text-muted-foreground">Section:</span>
                            <span className="font-medium ml-1">{sectionName}</span>
                        </div>
                        {section && (
                            <div>
                                <span className="text-muted-foreground">Grade:</span>
                                <span className="font-medium ml-1">{section.grade_name}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-muted-foreground">Day:</span>
                            <span className="font-medium ml-1">{day}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Period:</span>
                            <span className="font-medium ml-1">
                                {period.title || period.short_name || `P${period.sort_order}`}
                            </span>
                        </div>
                        {(period.start_time || period.end_time) && (
                            <div>
                                <span className="text-muted-foreground">Time:</span>
                                <span className="font-medium ml-1">{formatTimeRange(period.start_time, period.end_time)}</span>
                            </div>
                        )}
                    </div>

                    {conflictWarning && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{conflictWarning}</AlertDescription>
                        </Alert>
                    )}

                    {loadingData ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Subject Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Subject *</Label>
                                    {section?.grade_name && (
                                        <span className="text-xs text-muted-foreground">
                                            {section.grade_name} subjects
                                        </span>
                                    )}
                                </div>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.length === 0 ? (
                                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                                {loadingData ? "Loading subjects..." : "No subjects available"}
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
                                                {loadingData ? "Loading teachers..." : "No teachers available"}
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
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!selectedSubject || !selectedTeacher || !!conflictWarning || loading || loadingData}
                            className="bg-[#022172] hover:bg-[#022172]/90"
                        >
                            {loading ? "Saving..." : (existingEntry ? "Update" : "Assign")}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
