"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, X, Loader2 } from "lucide-react";
import { TimetableEntry } from "@/lib/api/timetable";
import { Period } from "@/lib/api/teachers";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_MAP: Record<string, number> = {
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4
};

interface SectionTimetableCardProps {
    sectionId: string;
    sectionName: string;
    gradeName?: string;
    periods: Period[];
    entries: TimetableEntry[];
    isLoading?: boolean;
    isCompact?: boolean;
    onSlotClick?: (sectionId: string, day: string, period: Period) => void;
    onDeleteEntry?: (entryId: string) => void;
}

export function SectionTimetableCard({
    sectionId,
    sectionName,
    gradeName,
    periods,
    entries,
    isLoading = false,
    isCompact = false,
    onSlotClick,
    onDeleteEntry
}: SectionTimetableCardProps) {

    const getEntryForSlot = (day: string, period: Period): TimetableEntry | undefined => {
        const dayNumber = DAY_MAP[day];
        return entries.find(
            e => e.day_of_week === dayNumber && e.period_id === period.id
        );
    };

    const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number);

    if (isLoading) {
        return (
            <Card className="min-w-[320px]">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant="secondary">{sectionName}</Badge>
                        {gradeName && <span className="text-xs text-muted-foreground">{gradeName}</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-8 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={`${isCompact ? 'min-w-[280px]' : 'min-w-[360px]'} flex-shrink-0`}>
            <CardHeader className="py-3 pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-[#022172]">{sectionName}</Badge>
                        {gradeName && <span className="text-xs text-muted-foreground">{gradeName}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground font-normal">
                        {entries.length} classes
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="border p-1.5 bg-muted/50 font-medium min-w-[50px]">
                                    Time
                                </th>
                                {DAYS.map(day => (
                                    <th
                                        key={day}
                                        className="border p-1.5 bg-muted/50 font-medium min-w-[50px]"
                                    >
                                        {isCompact ? day.slice(0, 3) : day.slice(0, 3)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPeriods.map(period => (
                                <tr key={period.id}>
                                    <td className="border p-1.5 bg-muted/30 text-center">
                                        <div className="font-medium">P{period.period_number}</div>
                                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {period.start_time?.slice(0, 5)}
                                        </div>
                                    </td>
                                    {DAYS.map(day => {
                                        const entry = getEntryForSlot(day, period);

                                        if (period.is_break) {
                                            return (
                                                <td
                                                    key={`${day}-${period.id}`}
                                                    className="border p-1 bg-amber-50 text-center text-muted-foreground"
                                                >
                                                    ☕
                                                </td>
                                            );
                                        }

                                        return (
                                            <td
                                                key={`${day}-${period.id}`}
                                                className={`border p-1 cursor-pointer transition-colors ${entry
                                                    ? 'bg-blue-50 hover:bg-blue-100'
                                                    : 'hover:bg-muted/50'
                                                    }`}
                                                onClick={() => onSlotClick?.(sectionId, day, period)}
                                            >
                                                {entry ? (
                                                    <div className="relative group">
                                                        <div className="font-medium text-[#022172] truncate max-w-[70px]" title={`${entry.subject_name} (${entry.subject_id?.slice(0, 8)}...)`}>
                                                            {entry.subject_name}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                                                            <User className="h-2.5 w-2.5 flex-shrink-0" />
                                                            <span className="truncate max-w-[60px]" title={entry.teacher_name}>
                                                                {entry.teacher_name}
                                                            </span>
                                                        </div>
                                                        {onDeleteEntry && (
                                                            <button
                                                                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center bg-red-500 text-white rounded-full"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteEntry(entry.id);
                                                                }}
                                                            >
                                                                <X className="h-2.5 w-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-muted-foreground py-1">
                                                        <Plus className="h-3 w-3 mx-auto opacity-30" />
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
            </CardContent>
        </Card>
    );
}
