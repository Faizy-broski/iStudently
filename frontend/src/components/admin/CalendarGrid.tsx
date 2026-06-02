"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
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

// ─── Custom Events Dropdown (NO Radix, zero propagation issues) ───────────────
interface EventsDropdownProps {
  events: SchoolEvent[];
  dayLabel: string;
  isArabic: boolean;
  onEventClick?: (event: SchoolEvent) => void;
}

function EventsDropdown({ events, dayLabel, isArabic, onEventClick }: EventsDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use capture:true so we get it before anything else
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  const handleBadgeMouseDown = (e: React.MouseEvent) => {
    // Stop EVERYTHING — this is the nuclear option that actually works
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopImmediatePropagation();
    setOpen((o) => !o);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      // Stop all events from reaching parent day cell
      onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
    >
      {/* Badge trigger */}
      <div
        role="button"
        tabIndex={0}
        onMouseDown={handleBadgeMouseDown}
        onClick={handleBadgeClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setOpen((o) => !o); } }}
        className={cn(
          "inline-flex items-center justify-center h-4 md:h-5 px-1 rounded-full text-[8px] md:text-xs font-semibold cursor-pointer select-none transition-colors",
          open
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
        )}
      >
        {events.length}
      </div>

      {/* Dropdown panel — rendered inline (not portalled), z-index above everything */}
      {open && (
        <div
          className={cn(
            "absolute top-full mt-1 w-56 rounded-lg border bg-popover shadow-lg z-[9999]",
            isArabic ? "right-0" : "left-0"
          )}
          dir={isArabic ? "rtl" : "ltr"}
          onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
          onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 rounded-t-lg">
            <div className="flex items-center gap-1.5 min-w-0">
              <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-semibold text-foreground truncate">{dayLabel}</span>
            </div>
            <button
              className="ml-1 shrink-0 rounded opacity-60 hover:opacity-100 transition-opacity"
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setOpen(false); }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Events list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {events.map((event) => (
              <button
                key={event.id}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-start gap-2 group"
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setOpen(false);
                  onEventClick?.(event);
                }}
              >
                <span
                  className="mt-0.5 h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: event.color_code }}
                />
                <span className="text-xs font-medium text-foreground group-hover:text-primary leading-tight">
                  {event.title}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t bg-muted/20 rounded-b-lg">
            <span className="text-[10px] text-muted-foreground">
              {isArabic
                ? `${toArabicNumerals(events.length)} ${events.length === 1 ? "حدث" : "أحداث"}`
                : `${events.length} event${events.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CalendarGrid Props ───────────────────────────────────────────────────────
interface CalendarGridProps {
  events: SchoolEvent[];
  calendarDays: CalendarDay[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: SchoolEvent) => void;
  calendarType: "gregorian" | "hijri";
  calendarStart?: string | null;
  calendarEnd?: string | null;
  weekdays?: boolean[];
  scheduleEntries?: Record<string, ScheduleViewEntry[]>;
}

// ─── Main CalendarGrid ────────────────────────────────────────────────────────
export function CalendarGrid({
  events,
  calendarDays,
  currentMonth,
  onMonthChange,
  onDateClick,
  onEventClick,
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

  const MONTHS_LOCALIZED = Array.from({ length: 12 }, (_, i) => tCommon(`months.${i}`));
  const WEEK_DAYS_FULL = Array.from({ length: 7 }, (_, i) => tCommon(`days.${i}`));
  const WEEK_DAYS_SHORT = isArabic
    ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HIJRI_MONTHS_LOCALIZED = isArabic ? HIJRI_MONTHS_AR : HIJRI_MONTHS;

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [globalHijriOffset, setGlobalHijriOffset] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem(HIJRI_OFFSET_KEY);
    if (saved !== null) setGlobalHijriOffset(parseInt(saved));
    const handleOffsetChange = (event: CustomEvent) => setGlobalHijriOffset(event.detail);
    window.addEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
    return () => window.removeEventListener('hijri-offset-changed', handleOffsetChange as EventListener);
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

  const goToPreviousMonth = () => { if (canGoPrev) onMonthChange(prevMonthDate); };
  const goToNextMonth = () => { if (canGoNext) onMonthChange(nextMonthDate); };

  const goToToday = () => {
    const today = new Date();
    if (calStartDate && today < calStartDate) { onMonthChange(calStartDate); return; }
    if (calEndDate   && today > calEndDate)   { onMonthChange(calEndDate);   return; }
    onMonthChange(today);
  };

  const handleMonthChange = (monthIndex: number) => {
    const d = new Date(currentMonth); d.setMonth(monthIndex); onMonthChange(d);
  };
  const handleYearChange = (year: number) => {
    const d = new Date(currentMonth); d.setFullYear(year); onMonthChange(d);
  };
  const handleHijriMonthChange = (monthIndex: number) => {
    const h = momentHijri(currentMonth);
    onMonthChange(momentHijri(`${h.iYear()}-${monthIndex + 1}-${h.iDate()}`, 'iYYYY-iM-iD').toDate());
  };
  const handleHijriYearChange = (year: number) => {
    const h = momentHijri(currentMonth);
    onMonthChange(momentHijri(`${year}-${h.iMonth() + 1}-${h.iDate()}`, 'iYYYY-iM-iD').toDate());
  };

  const generateGregorianDays = (): DayInfo[] => {
    const startOfMonth = moment(currentMonth).startOf("month");
    const endOfMonth = moment(currentMonth).endOf("month");
    const startDate = startOfMonth.clone().startOf("week");
    const endDate = endOfMonth.clone().endOf("week");
    const days: DayInfo[] = [];
    const day = startDate.clone();
    while (day.isSameOrBefore(endDate)) {
      const hd = momentHijri(day.toDate());
      if (globalHijriOffset !== 0) hd.add(globalHijriOffset, 'days');
      days.push({
        date: day.toDate(),
        dateKey: day.format("YYYY-MM-DD"),
        dayNumber: day.date(),
        isCurrentMonth: day.month() === startOfMonth.month(),
        isToday: day.isSame(moment(), "day"),
        hijriDate: `${isArabic ? toArabicNumerals(hd.iDate()) : hd.iDate()} ${HIJRI_MONTHS_LOCALIZED[hd.iMonth()]}`,
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
      const s = moment(currentMonth).startOf('month');
      while (true) {
        const c = momentHijri(s.toDate());
        if (globalHijriOffset !== 0) c.add(globalHijriOffset, 'days');
        if (c.iMonth() === hijriMonth && c.iYear() === hijriYear) return s;
        s.add(1, 'day');
        if (s.diff(moment(currentMonth), 'days') > 60) return s;
      }
    })();

    const startDate = firstDayGregorian.clone().startOf("week");
    const endDate = startDate.clone().add(41, 'days');
    const days: DayInfo[] = [];
    const day = startDate.clone();
    while (day.isSameOrBefore(endDate)) {
      const hd = momentHijri(day.toDate());
      if (globalHijriOffset !== 0) hd.add(globalHijriOffset, 'days');
      days.push({
        date: day.toDate(),
        dateKey: day.format("YYYY-MM-DD"),
        dayNumber: hd.iDate(),
        isCurrentMonth: hd.iMonth() === hijriMonth && hd.iYear() === hijriYear,
        isToday: day.isSame(moment(), "day"),
        gregorianDate: `${isArabic ? toArabicNumerals(day.date()) : day.date()} ${MONTHS_LOCALIZED[day.month()]}`,
      });
      day.add(1, "day");
    }
    return days;
  };

  const days = calendarType === "gregorian" ? generateGregorianDays() : generateHijriDays();

  const getEventsForDate = (dateKey: string) =>
    events.filter((e) => moment(e.start_at).format("YYYY-MM-DD") === dateKey);

  const getCalendarDay = (dateKey: string) =>
    calendarDays.find((d) => d.school_date === dateKey);

  const getDayLabel = (day: DayInfo): string => {
    if (calendarType === "gregorian") {
      return moment(day.date).format(isArabic ? "D MMMM YYYY" : "MMMM D, YYYY");
    }
    const hd = momentHijri(day.date);
    if (globalHijriOffset !== 0) hd.add(globalHijriOffset, 'days');
    const n = isArabic ? toArabicNumerals(hd.iDate()) : hd.iDate();
    const y = isArabic ? toArabicNumerals(hd.iYear()) : hd.iYear();
    return `${n} ${HIJRI_MONTHS_LOCALIZED[hd.iMonth()]} ${y}`;
  };

  const calendarTitle = calendarType === "gregorian" ? tEvents("tab_gregorian") : tEvents("tab_hijri");

  return (
    <div className="space-y-4 transition-opacity duration-200">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-3">{calendarTitle}</h2>
          {calendarType === "gregorian" ? (
            <div className="flex items-center gap-2">
              <Select value={moment(currentMonth).month().toString()} onValueChange={(v) => handleMonthChange(parseInt(v))}>
                <SelectTrigger className="w-35"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS_LOCALIZED.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={moment(currentMonth).year().toString()} onValueChange={(v) => handleYearChange(parseInt(v))}>
                <SelectTrigger className="w-25"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GREGORIAN_YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select value={momentHijri(currentMonth).iMonth().toString()} onValueChange={(v) => handleHijriMonthChange(parseInt(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HIJRI_MONTHS_LOCALIZED.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={momentHijri(currentMonth).iYear().toString()} onValueChange={(v) => handleHijriYearChange(parseInt(v))}>
                <SelectTrigger className="w-25"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HIJRI_YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
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

      {/* Calendar grid */}
      <Card className="transition-all duration-200">
        <CardContent className="p-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {WEEK_DAYS_FULL.map((d, idx) => (
              <div key={idx} className="text-center text-[10px] md:text-sm font-semibold py-2">
                <span className="hidden md:inline">{d}</span>
                <span className="md:hidden">{WEEK_DAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dayEvents = getEventsForDate(day.dateKey);
              const hasEvents = dayEvents.length > 0;
              const calDay = getCalendarDay(day.dateKey);
              const dowIndex = day.date.getDay();
              const isWeekdayOff = weekdays ? weekdays[dowIndex] === false : false;
              const isSchoolDay = calDay ? calDay.is_school_day : !isWeekdayOff;
              const isHoliday = calDay ? !calDay.is_school_day : isWeekdayOff;
              const isPartialDay = calDay?.is_school_day && calDay.minutes > 0 && calDay.minutes < 360;
              const dayLabel = getDayLabel(day);

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
                  // ── CLEAN onClick: only fires when the click target is NOT inside the events dropdown ──
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    // The EventsDropdown wraps everything in a div with class "relative"
                    // We mark it with data-no-date-click to safely skip
                    if (target.closest('[data-no-date-click]')) return;
                    onDateClick?.(day.date);
                  }}
                  onMouseEnter={() => setHoveredDate(day.dateKey)}
                  onMouseLeave={() => setHoveredDate(null)}
                  dir={isArabic ? "rtl" : "ltr"}
                >
                  {/* Day number + events badge row */}
                  <div className={cn(
                    "flex items-start justify-between mb-0.5 md:mb-1",
                    isArabic && "flex-row-reverse"
                  )}>
                    <span className={cn(
                      "text-xs md:text-sm font-semibold",
                      day.isToday
                        ? "h-5 w-5 md:h-6 md:w-6 flex items-center justify-center rounded-full bg-[#022172] text-white dark:bg-[#57A3CC]"
                        : day.isCurrentMonth && (isSchoolDay || isHoliday)
                          ? "text-gray-900 dark:text-gray-200"
                          : "text-foreground"
                    )}>
                      {formatNumber(day.dayNumber, isArabic)}
                    </span>

                    {/* Events badge — wrapped in data-no-date-click so parent onClick skips it */}
                    {hasEvents && (
                      <div data-no-date-click>
                        <EventsDropdown
                          events={dayEvents}
                          dayLabel={dayLabel}
                          isArabic={isArabic}
                          onEventClick={onEventClick}
                        />
                      </div>
                    )}
                  </div>

                  {/* Sub-date label (hijri/gregorian) */}
                  <div className={cn(
                    "text-[8px] md:text-[10px] mb-0.5 md:mb-1 truncate",
                    isArabic ? "text-right" : "text-left",
                    !day.isCurrentMonth && "opacity-80",
                    day.isCurrentMonth && (isSchoolDay || isHoliday) && !day.isToday
                      ? "text-gray-600 dark:text-gray-300"
                      : "text-muted-foreground opacity-80"
                  )}>
                    {calendarType === "gregorian" ? day.hijriDate : day.gregorianDate}
                  </div>

                  {/* School / Holiday label */}
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

                  {/* Schedule entries + event pills */}
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

                    {/* Mobile: color dots */}
                    <div className="flex flex-wrap gap-0.5 md:hidden">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ev.color_code }} />
                      ))}
                    </div>

                    {/* Desktop: event pills */}
                    <div className="hidden md:block space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-sm truncate cursor-pointer hover:opacity-80 font-medium text-gray-800 dark:text-gray-100 bg-white/60 dark:bg-gray-950/40 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                          style={{ borderLeft: `3px solid ${event.color_code}` }}
                          onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
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
    </div>
  );
}
