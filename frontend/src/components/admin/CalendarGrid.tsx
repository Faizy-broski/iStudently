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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import moment from "moment";
import momentHijri from "moment-hijri";
import { type SchoolEvent } from "@/lib/api/events";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { type CalendarDay, type ScheduleViewEntry } from "@/lib/api/attendance-calendars";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const HIJRI_OFFSET_KEY = "studently_global_hijri_offset";

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
];

const HIJRI_MONTHS_AR = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الثانية", "رجب", "شعبان",
  "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

const currentYear = new Date().getFullYear();
const GREGORIAN_YEARS = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
const HIJRI_YEARS = Array.from({ length: 21 }, (_, i) => momentHijri().iYear() - 10 + i);

const toArabicNumerals = (num: number): string =>
  String(num).replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + parseInt(d)));

const toWesternNumerals = (str: string): string =>
  str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

const formatNumber = (num: number, isArabic: boolean): string =>
  isArabic ? toArabicNumerals(num) : String(num);

interface DayInfo {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hijriDate?: string;
  gregorianDate?: string;
}

const SCHEDULE_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16',
];

function getSectionColor(sectionId: string): string {
  let hash = 0;
  for (let i = 0; i < sectionId.length; i++) {
    hash = sectionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SCHEDULE_PALETTE[Math.abs(hash) % SCHEDULE_PALETTE.length];
}

interface CalendarGridProps {
  events: SchoolEvent[];
  calendarDays: CalendarDay[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: SchoolEvent) => void;
  onAddEvent?: (date: Date) => void;
  calendarType: "gregorian" | "hijri";
  calendarStart?: string | null;
  calendarEnd?: string | null;
  weekdays?: boolean[];
  scheduleEntries?: Record<string, ScheduleViewEntry[]>;
}

export function CalendarGrid({
  events,
  calendarDays,
  currentMonth,
  onMonthChange,
  onDateClick,
  onEventClick,
  onAddEvent,
  calendarType,
  calendarStart,
  calendarEnd,
  weekdays,
  scheduleEntries,
}: CalendarGridProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const tCommon = useTranslations("common");
  const tEvents = useTranslations("school.events");

  const MONTHS_LOCALIZED = Array.from({ length: 12 }, (_, i) =>
    tCommon(`months.${i}`)
  );

  const WEEK_DAYS_FULL = Array.from({ length: 7 }, (_, i) =>
    tCommon(`days.${i}`)
  );

  const WEEK_DAYS_SHORT = isArabic
    ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Hijri calendar always uses Arabic names — it IS the Arabic calendar
  const WEEK_DAYS_AR_FULL = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const WEEK_DAYS_AR_SHORT = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

  const isHijriMode = calendarType === "hijri";
  // In Hijri mode, always treat as Arabic for formatting
  const useArabic = isArabic || isHijriMode;

  // Hijri months: always Arabic in Hijri mode since it's the Arabic calendar
  const HIJRI_MONTHS_LOCALIZED = (isArabic || isHijriMode) ? HIJRI_MONTHS_AR : HIJRI_MONTHS;

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [globalHijriOffset, setGlobalHijriOffset] = useState<number>(0);

  const [dayEventsDialog, setDayEventsDialog] = useState<{
    open: boolean;
    date: Date | null;
    events: SchoolEvent[];
  }>({ open: false, date: null, events: [] });

  useEffect(() => {
    const loadOffset = () => {
      const saved = localStorage.getItem(HIJRI_OFFSET_KEY);
      if (saved !== null) {
        setGlobalHijriOffset(parseInt(saved));
      }
    };
    loadOffset();
    const handleOffsetChange = (event: CustomEvent) => {
      setGlobalHijriOffset(event.detail);
    };
    window.addEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
    return () => {
      window.removeEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
    };
  }, []);

  const calStartDate = calendarStart ? new Date(calendarStart) : null;
  const calEndDate   = calendarEnd   ? new Date(calendarEnd)   : null;

  const isBeforeStart = (d: Date) =>
    !!calStartDate &&
    (d.getFullYear() < calStartDate.getFullYear() ||
      (d.getFullYear() === calStartDate.getFullYear() && d.getMonth() < calStartDate.getMonth()));

  const isAfterEnd = (d: Date) =>
    !!calEndDate &&
    (d.getFullYear() > calEndDate.getFullYear() ||
      (d.getFullYear() === calEndDate.getFullYear() && d.getMonth() > calEndDate.getMonth()));

  const prevMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const nextMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  const canGoPrev = !isBeforeStart(prevMonthDate);
  const canGoNext = !isAfterEnd(nextMonthDate);

  const goToPreviousMonth = () => { if (!canGoPrev) return; onMonthChange(prevMonthDate); };
  const goToNextMonth = () => { if (!canGoNext) return; onMonthChange(nextMonthDate); };

  const goToToday = () => {
    const today = new Date();
    if (calStartDate && today < calStartDate) { onMonthChange(calStartDate); return; }
    if (calEndDate   && today > calEndDate)   { onMonthChange(calEndDate);   return; }
    onMonthChange(today);
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
    const currentHijri = momentHijri(currentMonth);
    const currentYear = currentHijri.iYear();
    const currentDay = currentHijri.iDate();
    const newHijriDate = momentHijri(`${currentYear}-${monthIndex + 1}-${currentDay}`, 'iYYYY-iM-iD');
    onMonthChange(newHijriDate.toDate());
  };

  const handleHijriYearChange = (year: number) => {
    const currentHijri = momentHijri(currentMonth);
    const currentMonth_hijri = currentHijri.iMonth();
    const currentDay = currentHijri.iDate();
    const newHijriDate = momentHijri(`${year}-${currentMonth_hijri + 1}-${currentDay}`, 'iYYYY-iM-iD');
    onMonthChange(newHijriDate.toDate());
  };

  const generateCalendarDays = () => {
    if (calendarType === "gregorian") return generateGregorianDays();
    else return generateHijriDays();
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
        hijriDate: (() => {
          const hd = momentHijri(day.toDate());
          if (globalHijriOffset !== 0) hd.add(globalHijriOffset, 'days');
          const dayNum = hd.iDate();
          const monthName = HIJRI_MONTHS_LOCALIZED[hd.iMonth()];
          const formattedNum = useArabic ? toArabicNumerals(dayNum) : String(dayNum);
          return useArabic ? `${formattedNum} ${monthName}` : `${formattedNum} ${monthName}`;
        })(),
      });
      day.add(1, "day");
    }
    return days;
  };

  const generateHijriDays = (): DayInfo[] => {
    const currentHijri = momentHijri(currentMonth);
    if (globalHijriOffset !== 0) currentHijri.add(globalHijriOffset, 'days');
    const hijriMonth = currentHijri.iMonth();
    const hijriYear = currentHijri.iYear();

    const firstDayGregorian = (() => {
      const startSearch = moment(currentMonth).startOf('month');
      while (true) {
        const checkHijri = momentHijri(startSearch.toDate());
        if (globalHijriOffset !== 0) checkHijri.add(globalHijriOffset, 'days');
        if (checkHijri.iMonth() === hijriMonth && checkHijri.iYear() === hijriYear) return startSearch;
        startSearch.add(1, 'day');
        if (startSearch.diff(moment(currentMonth), 'days') > 60) return startSearch;
      }
    })();

    const startDate = firstDayGregorian.clone().startOf("week");
    const endDate = startDate.clone().add(41, 'days');

    const days: DayInfo[] = [];
    const day = startDate.clone();

    while (day.isSameOrBefore(endDate)) {
      const hijriDay = momentHijri(day.toDate());
      if (globalHijriOffset !== 0) hijriDay.add(globalHijriOffset, 'days');
      const isCurrentHijriMonth = hijriDay.iMonth() === hijriMonth && hijriDay.iYear() === hijriYear;

      const gregMonth = MONTHS_LOCALIZED[day.month()];
      const gregDay = day.date();

      const hijriMonthName = HIJRI_MONTHS_LOCALIZED[hijriDay.iMonth()];
      const hijriDayNum = hijriDay.iDate();
      days.push({
        date: day.toDate(),
        dateKey: day.format("YYYY-MM-DD"),
        dayNumber: hijriDay.iDate(),
        isCurrentMonth: isCurrentHijriMonth,
        isToday: day.isSame(moment(), "day"),
        gregorianDate: isArabic
          ? `${toArabicNumerals(hijriDayNum)} ${hijriMonthName}`
          : `${hijriDayNum} ${hijriMonthName}`,
      });
      day.add(1, "day");
    }
    return days;
  };

  const days = calendarType === "hijri" ? generateHijriDays() : generateCalendarDays();

  const getEventsForDate = (dateKey: string) => {
    return events.filter((event) => {
      const eventDate = moment(event.start_at).format("YYYY-MM-DD");
      return eventDate === dateKey;
    });
  };

  const getCalendarDay = (dateKey: string) => {
    return calendarDays.find((d) => d.school_date === dateKey);
  };

  const handleBadgeClick = (e: React.MouseEvent, date: Date, dayEvents: SchoolEvent[]) => {
    e.stopPropagation();
    setDayEventsDialog({ open: true, date, events: dayEvents });
  };

  const handleDayNumberClick = (e: React.MouseEvent, date: Date, dayEvents: SchoolEvent[]) => {
    e.stopPropagation();
    // Always open the day popup — shows events if any, or an "Add Event" option
    setDayEventsDialog({ open: true, date, events: dayEvents });
  };

  const calendarTitle = calendarType === "gregorian"
    ? tEvents("tab_gregorian")
    : tEvents("tab_hijri");

  return (
    <div className="space-y-4 transition-opacity duration-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-3">
            {calendarTitle}
          </h2>
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
                  {MONTHS_LOCALIZED.map((month, index) => (
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
                  {HIJRI_MONTHS_LOCALIZED.map((month, index) => (
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
          <Button variant="outline" size="sm" onClick={goToPreviousMonth} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {isArabic ? "اليوم" : "Today"}
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth} disabled={!canGoNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="transition-all duration-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {(isHijriMode ? WEEK_DAYS_AR_FULL : WEEK_DAYS_FULL).map((day, idx) => (
              <div
                key={idx}
                className="text-center text-[10px] md:text-sm font-semibold py-2"
              >
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{(isHijriMode ? WEEK_DAYS_AR_SHORT : WEEK_DAYS_SHORT)[idx]}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dayEvents = getEventsForDate(day.dateKey);
              const hasEvents = dayEvents.length > 0;
              const calDay = getCalendarDay(day.dateKey);
              const dowIndex = day.date.getDay();
              const isWeekdayOff = weekdays ? weekdays[dowIndex] === false : false;
              const isSchoolDay = calDay ? calDay.is_school_day : (!isWeekdayOff);
              const isHoliday = calDay ? !calDay.is_school_day : isWeekdayOff;
              const isPartialDay = calDay?.is_school_day && calDay.minutes > 0 && calDay.minutes < 360;

              return (
                <div
                  key={day.dateKey}
                  className={cn(
                    "min-h-[60px] md:min-h-[100px] p-1 md:p-2 rounded-lg border transition-all duration-150 cursor-pointer",
                    day.isCurrentMonth
                      ? isSchoolDay
                        ? isPartialDay
                          ? "bg-[#D4D4FF] border-[#B8B8FF] dark:bg-indigo-900/30 dark:border-indigo-800/50"
                          : "bg-[#D4FFD4] border-[#B8FFB8] dark:bg-green-900/30 dark:border-green-800/50"
                        : isHoliday
                        ? "bg-[#FFD4D4] border-[#FFB8B8] dark:bg-red-900/30 dark:border-red-800/50"
                        : "bg-background hover:bg-muted/50"
                      : "bg-muted/30 opacity-50 dark:opacity-70 text-gray-500",
                    day.isToday && "ring-2 ring-[#022172] bg-[#022172]/15 dark:ring-[#57A3CC] dark:bg-[#57A3CC]/25",
                    hoveredDate === day.dateKey && "shadow-md brightness-95"
                  )}
                  onClick={() => onDateClick?.(day.date)}
                  onMouseEnter={() => setHoveredDate(day.dateKey)}
                  onMouseLeave={() => setHoveredDate(null)}
                  dir={isArabic ? "rtl" : "ltr"}
                >
                  <div className={cn(
                    "flex items-start justify-between mb-0.5 md:mb-1",
                    isArabic && "flex-row-reverse"
                  )}>
                    <span
                      className={cn(
                        "text-xs md:text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity",
                        day.isToday
                          ? "h-5 w-5 md:h-6 md:w-6 flex items-center justify-center rounded-full bg-[#022172] text-white dark:bg-[#57A3CC]"
                          : day.isCurrentMonth && (isSchoolDay || isHoliday)
                          ? "text-gray-900 dark:text-gray-200"
                          : "text-foreground"
                      )}
                      onClick={(e) => handleDayNumberClick(e, day.date, dayEvents)}
                    >
                      {isHijriMode ? String(day.dayNumber) : formatNumber(day.dayNumber, isArabic)}
                    </span>
                    {hasEvents && (
                      <Badge
                        variant="secondary"
                        className="h-4 md:h-5 px-1 text-[8px] md:text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={(e) => handleBadgeClick(e, day.date, dayEvents)}
                      >
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>

                  <div className={cn(
                    "text-[8px] md:text-[10px] mb-0.5 md:mb-1 truncate",
                    isArabic ? "text-right" : "text-left",
                    !day.isCurrentMonth && "opacity-80",
                    day.isCurrentMonth && (isSchoolDay || isHoliday) && !day.isToday ? "text-gray-600 dark:text-gray-300" : "text-muted-foreground opacity-80"
                  )}>
                    {calendarType === "gregorian" ? day.hijriDate : day.gregorianDate}
                  </div>

                  {calDay && (
                    <div className="mb-1 hidden md:block">
                      {isSchoolDay ? (
                        <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase">
                          {isArabic ? "مدرسة" : "School"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-red-700 dark:text-red-400 font-bold uppercase">
                          {isArabic ? "عطلة" : "Holiday"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto">
                    {scheduleEntries && (
                      <div className="hidden md:block space-y-0.5 mb-1">
                        {(scheduleEntries[day.dateKey] || []).map((entry) => {
                          const color = getSectionColor(entry.section_id);
                          const label = entry.subject_code || entry.subject_name.slice(0, 7);
                          const period = entry.period_name || `P${entry.period_number}`;
                          return (
                            <TooltipProvider key={entry.id} delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="text-[10px] leading-tight px-1.5 py-0.5 rounded-sm truncate cursor-default bg-white/60 dark:bg-gray-950/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                    style={{ borderLeft: `3px solid ${color}` }}
                                  >
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
                                    <span className="text-gray-600 dark:text-gray-400 ml-1">{period}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[200px] space-y-1 text-xs">
                                  <p className="font-semibold">{entry.subject_name}</p>
                                  <p className="text-muted-foreground">{entry.section_name} · {entry.grade_name}</p>
                                  <p className="text-muted-foreground">{entry.teacher_name}</p>
                                  {entry.start_time && (
                                    <p className="text-muted-foreground">{entry.start_time}–{entry.end_time}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-0.5 md:hidden">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ev.color_code }} />
                      ))}
                    </div>

                    <div className="hidden md:block space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-sm truncate cursor-pointer hover:opacity-80 font-medium text-gray-800 dark:text-gray-100 bg-white/60 dark:bg-gray-950/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                          style={{ borderLeft: `3px solid ${event.color_code}` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dayEventsDialog.open}
        onOpenChange={(open) => setDayEventsDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>
                {dayEventsDialog.date
                  ? moment(dayEventsDialog.date).format("dddd, MMMM D, YYYY")
                  : ""}
              </span>
              {dayEventsDialog.events.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground shrink-0">
                  {dayEventsDialog.events.length}{" "}
                  {isArabic
                    ? dayEventsDialog.events.length === 1 ? "حدث" : "أحداث"
                    : dayEventsDialog.events.length === 1 ? "event" : "events"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {dayEventsDialog.events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {isArabic ? "لا توجد أحداث لهذا اليوم" : "No events for this day"}
                </p>
              </div>
            ) : (
              dayEventsDialog.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setDayEventsDialog((prev) => ({ ...prev, open: false }));
                    onEventClick?.(event);
                  }}
                >
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: event.color_code }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {event.is_all_day
                        ? (isArabic ? "طوال اليوم" : "All day")
                        : moment(event.start_at).format("h:mm A")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Event button — shown only when onAddEvent prop is provided */}
          {onAddEvent && (
            <div className="pt-3 border-t">
              <button
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90 transition-opacity"
                onClick={() => {
                  setDayEventsDialog((prev) => ({ ...prev, open: false }));
                  onAddEvent(dayEventsDialog.date!);
                }}
              >
                <span>+</span>
                {isArabic ? "إضافة حدث لهذا اليوم" : "Add Event for this day"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
