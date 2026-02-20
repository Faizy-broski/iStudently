"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import moment from "moment";
import momentHijri from "moment-hijri";
import { type SchoolEvent } from "@/lib/api/events";
import { cn } from "@/lib/utils";

const HIJRI_OFFSET_KEY = "studently_global_hijri_offset";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

// Generate years array (10 years back and 10 years forward)
const currentYear = new Date().getFullYear();
const GREGORIAN_YEARS = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
const HIJRI_YEARS = Array.from({ length: 21 }, (_, i) => momentHijri().iYear() - 10 + i);

interface DayInfo {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hijriDate?: string;
  gregorianDate?: string;
}


import { type CalendarDay } from "@/lib/api/attendance-calendars";

interface CalendarGridProps {
  events: SchoolEvent[];
  calendarDays: CalendarDay[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: SchoolEvent) => void;
  calendarType: "gregorian" | "hijri";
}

export function CalendarGrid({
  events,
  calendarDays,
  currentMonth,
  onMonthChange,
  onDateClick,
  onEventClick,
  calendarType,
}: CalendarGridProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [globalHijriOffset, setGlobalHijriOffset] = useState<number>(0);

  // Load global Hijri offset
  useEffect(() => {
    const loadOffset = () => {
      const saved = localStorage.getItem(HIJRI_OFFSET_KEY);
      if (saved !== null) {
        setGlobalHijriOffset(parseInt(saved));
      }
    };

    loadOffset();

    // Listen for offset changes
    const handleOffsetChange = (event: CustomEvent) => {
      setGlobalHijriOffset(event.detail);
    };

    window.addEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
    return () => {
      window.removeEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
    };
  }, []);

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  const goToToday = () => {
    onMonthChange(new Date());
  };

  const handleMonthChange = (monthIndex: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(monthIndex);
    onMonthChange(newDate);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(year);
    onMonthChange(newDate);
  };

  const handleHijriMonthChange = (monthIndex: number) => {
    // Create a new Hijri date with the selected month
    const currentHijri = momentHijri(currentMonth);
    const currentYear = currentHijri.iYear();
    const currentDay = currentHijri.iDate();
    
    // Create new date with updated month
    const newHijriDate = momentHijri(`${currentYear}-${monthIndex + 1}-${currentDay}`, 'iYYYY-iM-iD');
    onMonthChange(newHijriDate.toDate());
  };

  const handleHijriYearChange = (year: number) => {
    // Create a new Hijri date with the selected year
    const currentHijri = momentHijri(currentMonth);
    const currentMonth_hijri = currentHijri.iMonth();
    const currentDay = currentHijri.iDate();
    
    // Create new date with updated year
    const newHijriDate = momentHijri(`${year}-${currentMonth_hijri + 1}-${currentDay}`, 'iYYYY-iM-iD');
    onMonthChange(newHijriDate.toDate());
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    if (calendarType === "gregorian") {
      return generateGregorianDays();
    } else {
      return generateHijriDays();
    }
  };

  const generateGregorianDays = (): DayInfo[] => {
    const startOfMonth = moment(currentMonth).startOf("month");
    const endOfMonth = moment(currentMonth).endOf("month");
    const startDate = startOfMonth.clone().startOf("week");
    const endDate = endOfMonth.clone().endOf("week");

    const days: DayInfo[] = [];
    const day = startDate.clone();

    while (day.isSameOrBefore(endDate)) {
      days.push({
        date: day.toDate(),
        dateKey: day.format("YYYY-MM-DD"),
        dayNumber: day.date(),
        isCurrentMonth: day.month() === startOfMonth.month(),
        isToday: day.isSame(moment(), "day"),
        hijriDate: momentHijri(day.toDate()).format("iD iMMMM"),
      });
      day.add(1, "day");
    }

    return days;
  };

  const generateHijriDays = (): DayInfo[] => {
    // Convert current Gregorian month to Hijri with offset
    const currentHijri = momentHijri(currentMonth);
    if (globalHijriOffset !== 0) {
      currentHijri.add(globalHijriOffset, 'days');
    }
    
    // Get the Hijri month and year
    const hijriMonth = currentHijri.iMonth();
    const hijriYear = currentHijri.iYear();
    
    // Find the first day of this Hijri month in Gregorian calendar
    const firstDayGregorian = (() => {
      const startSearch = moment(currentMonth).startOf('month');
      while (true) {
        const checkHijri = momentHijri(startSearch.toDate());
        if (globalHijriOffset !== 0) {
          checkHijri.add(globalHijriOffset, 'days');
        }
        if (checkHijri.iMonth() === hijriMonth && checkHijri.iYear() === hijriYear) {
          return startSearch;
        }
        startSearch.add(1, 'day');
        // Safety check to avoid infinite loop
        if (startSearch.diff(moment(currentMonth), 'days') > 60) return startSearch;
      }
    })();
    
    // Get start of week for this date
    const startDate = firstDayGregorian.clone().startOf("week");
    
    // Calculate roughly 6 weeks to cover the month
    const endDate = startDate.clone().add(41, 'days');

    const days: DayInfo[] = [];
    const day = startDate.clone();

    while (day.isSameOrBefore(endDate)) {
      const hijriDay = momentHijri(day.toDate());
      if (globalHijriOffset !== 0) {
        hijriDay.add(globalHijriOffset, 'days');
      }
      const isCurrentHijriMonth = hijriDay.iMonth() === hijriMonth && hijriDay.iYear() === hijriYear;

      days.push({
        date: day.toDate(),
        dateKey: day.format("YYYY-MM-DD"),
        dayNumber: hijriDay.iDate(),
        isCurrentMonth: isCurrentHijriMonth,
        isToday: day.isSame(moment(), "day"),
        gregorianDate: day.format("D MMMM"),
      });
      day.add(1, "day");
    }

    return days;
  };

  const days = generateCalendarDays();


  // Get events for a specific date
  const getEventsForDate = (dateKey: string) => {
    return events.filter((event) => {
      const eventDate = moment(event.start_at).format("YYYY-MM-DD");
      return eventDate === dateKey;
    });
  };

  // Get calendar day info for a specific date
  const getCalendarDay = (dateKey: string) => {
    return calendarDays.find((d) => d.school_date === dateKey);
  };

  // Format month header
  const monthHeader =
    calendarType === "gregorian"
      ? moment(currentMonth).format("MMMM YYYY")
      : momentHijri(currentMonth).format("iMMMM iYYYY");

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4 transition-opacity duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-3">
            {calendarType === "gregorian" ? "Gregorian Calendar" : "Hijri Calendar"}
          </h2>
          {/* Month & Year Dropdowns */}
          {calendarType === "gregorian" ? (
            <div className="flex items-center gap-2">
              <Select
                value={moment(currentMonth).month().toString()}
                onValueChange={(value) => handleMonthChange(parseInt(value))}
              >
                <SelectTrigger className="w-35">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={moment(currentMonth).year().toString()}
                onValueChange={(value) => handleYearChange(parseInt(value))}
              >
                <SelectTrigger className="w-25">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GREGORIAN_YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={momentHijri(currentMonth).iMonth().toString()}
                onValueChange={(value) => handleHijriMonthChange(parseInt(value))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIJRI_MONTHS.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={momentHijri(currentMonth).iYear().toString()}
                onValueChange={(value) => handleHijriYearChange(parseInt(value))}
              >
                <SelectTrigger className="w-25">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HIJRI_YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="transition-all duration-200">
        <CardContent className="p-4">
          {/* Week days header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-semibold py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dayEvents = getEventsForDate(day.dateKey);
              const hasEvents = dayEvents.length > 0;
              const calDay = getCalendarDay(day.dateKey);
              const isSchoolDay = calDay?.is_school_day;
              const isHoliday = calDay && !calDay.is_school_day;
              const isPartialDay = calDay?.is_school_day && calDay.minutes > 0 && calDay.minutes < 360;
              
              return (
                <div
                  key={day.dateKey}
                  className={cn(
                    "min-h-[100px] p-2 rounded-lg border transition-all duration-150 cursor-pointer",
                    day.isCurrentMonth
                      ? isSchoolDay
                        ? isPartialDay
                          ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20"
                          : "bg-green-50 border-green-200 dark:bg-green-900/20"
                        : isHoliday
                        ? "bg-pink-50 border-pink-200 dark:bg-pink-900/20"
                        : "bg-background hover:bg-muted/50"
                      : "bg-muted/20 opacity-50",
                    day.isToday && "ring-2 ring-brand",
                    hoveredDate === day.dateKey && "shadow-md"
                  )}
                  onClick={() => onDateClick?.(day.date)}
                  onMouseEnter={() => setHoveredDate(day.dateKey)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        day.isToday && "text-brand"
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    {hasEvents && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>

                  {/* Alternate calendar date */}
                  <div className="text-[10px] opacity-60 mb-1">
                    {calendarType === "gregorian" ? day.hijriDate : day.gregorianDate}
                  </div>

                  {/* School day/holiday indicator */}
                  {calDay && (
                    <div className="mb-1">
                      {isSchoolDay ? (
                        <span className="text-xs text-green-600 font-semibold">School Day</span>
                      ) : (
                        <span className="text-xs text-red-500 font-semibold">Holiday</span>
                      )}
                    </div>
                  )}

                  {/* Events for this day */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded truncate cursor-pointer transition-all duration-150 hover:opacity-80 hover:scale-[1.02]"
                        style={{
                          backgroundColor: event.color_code + "20",
                          borderLeft: `3px solid ${event.color_code}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs opacity-60 pl-1">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
