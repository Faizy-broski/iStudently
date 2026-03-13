"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, FileText, Users, Zap, Bell, Calendar as CalendarBadge, Settings2, Edit, Trash2, Info, CalendarDays, CalendarRange, Copy, Check, List, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  deleteEvent,
  type SchoolEvent,
  type EventCategory
} from "@/lib/api/events";
import { getICalLink, type ICalType } from "@/lib/api/ical";
import { EventFormDialog } from "@/components/admin/EventFormDialog";
import { CalendarGrid } from "@/components/admin/CalendarGrid";
import { EventDetailsDialog } from "@/components/admin/EventDetailsDialog";
import {
  getCalendars,
  getCalendarDays,
  updateCalendar,
  deleteCalendar,
  toggleCalendarDay,
  getCalendarScheduleView,
  type CalendarDay,
  type AttendanceCalendar,
  type ScheduleViewEntry,
} from "@/lib/api/attendance-calendars";
import { getAcademicYears, type AcademicYear } from "@/lib/api/academics";
import useSWR, { mutate } from "swr";
import { useEvents, useCategoryCounts } from "@/hooks/useEvents";
import { useCampus } from "@/context/CampusContext";
import { useSchoolSettings } from "@/context/SchoolSettingsContext";
import { toast } from "sonner";
import moment from "moment";

const EVENT_COLORS: Record<EventCategory, string> = {
  academic: '#3b82f6',
  holiday: '#ef4444',
  exam: '#f59e0b',
  meeting: '#8b5cf6',
  activity: '#10b981',
  reminder: '#6b7280'
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: 'Academic',
  holiday: 'Holiday',
  exam: 'Exam',
  meeting: 'Meeting',
  activity: 'Activity',
  reminder: 'Reminder'
};

export default function EventsPage() {
  const router = useRouter();
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;
  const { isPluginActive } = useSchoolSettings();
  const schedulePluginActive = isPluginActive('calendar_schedule_view');
  const icalPluginActive = isPluginActive('icalendar');

  // iCalendar state
  const [icalLoading, setIcalLoading] = useState<ICalType | null>(null);
  const [icalUrls, setIcalUrls] = useState<Record<ICalType, string>>({ events: '', schedule: '' });
  const [icalCopied, setIcalCopied] = useState<ICalType | null>(null);
  const [showIcalPopover, setShowIcalPopover] = useState(false);

  async function fetchIcalLink(type: ICalType) {
    if (icalUrls[type]) return; // already fetched
    setIcalLoading(type);
    try {
      const res = await getICalLink({ type, campusId });
      if (res.data?.url) {
        setIcalUrls(prev => ({ ...prev, [type]: res.data!.url }));
      } else {
        toast.error(res.error || 'Failed to generate link');
      }
    } catch {
      toast.error('Failed to generate iCalendar link');
    } finally {
      setIcalLoading(null);
    }
  }

  async function copyIcalLink(type: ICalType) {
    // If URL already fetched, copy directly
    if (icalUrls[type]) {
      await navigator.clipboard.writeText(icalUrls[type]);
      setIcalCopied(type);
      setTimeout(() => setIcalCopied(null), 2000);
      return;
    }
    // Otherwise fetch fresh from the API (avoids stale-closure issue)
    const res = await getICalLink({ type, campusId });
    const url = res.data?.url;
    if (!url) { toast.error(res.error || 'Failed to generate link'); return; }
    setIcalUrls(prev => ({ ...prev, [type]: url }));
    await navigator.clipboard.writeText(url);
    setIcalCopied(type);
    setTimeout(() => setIcalCopied(null), 2000);
  }

  async function downloadIcal(type: ICalType) {
    let url = icalUrls[type];
    if (!url) {
      await fetchIcalLink(type);
      // After fetch, icalUrls state may not yet be updated in this closure.
      // Re-read by triggering a download once state settles via a follow-up effect is complex,
      // so we instead get the URL directly from the API response here.
      const res = await getICalLink({ type, campusId });
      url = res.data?.url || '';
      if (!url) { toast.error(res.error || 'Failed to generate link'); return; }
    }
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = type === 'schedule' ? 'class-schedule.ics' : 'school-events.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error('Download failed. Try copying the link instead.');
    }
  }

  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Schedule View mode
  const [scheduleViewMode, setScheduleViewMode] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
  const [gregorianCalendar, setGregorianCalendar] = useState<AttendanceCalendar | null>(null);
  const [hijriCalendar, setHijriCalendar] = useState<AttendanceCalendar | null>(null);
  const [activeTab, setActiveTab] = useState<'gregorian' | 'hijri'>('gregorian');
  
  // Event states
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SchoolEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Attendance calendar management states
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showDeleteCalendarDialog, setShowDeleteCalendarDialog] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<AttendanceCalendar | null>(null);
  const [calendarToDelete, setCalendarToDelete] = useState<AttendanceCalendar | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    is_default: false,
    from_day: '1',
    from_month: '0',
    from_year: new Date().getFullYear().toString(),
    to_day: '1',
    to_month: '0',
    to_year: (new Date().getFullYear() + 1).toString(),
    weekdays: [false, true, true, true, true, true, false],
    default_minutes: '360',
  });

  // Fetch all calendars
  const { data: allCalendars, mutate: mutateCalendars } = useSWR(
    ["attendance-calendars", campusId],
    async () => {
      const res = await getCalendars(campusId);
      return res.success && res.data ? res.data : [];
    }
  );

  // Set default calendars when data loads; jump the grid to the calendar's start month
  useEffect(() => {
    if (allCalendars && allCalendars.length > 0) {
      const greg = allCalendars.find(c => c.calendar_type === "gregorian" && c.is_default) || 
                   allCalendars.find(c => c.calendar_type === "gregorian");
      const hij = allCalendars.find(c => c.calendar_type === "hijri" && c.is_default) || 
                  allCalendars.find(c => c.calendar_type === "hijri");
      if (greg) setGregorianCalendar(greg);
      if (hij) setHijriCalendar(hij);

      // Jump the grid to the active calendar's start month
      const active = activeTab === 'gregorian' ? greg : hij;
      if (active?.start_date) {
        setCurrentMonth(new Date(active.start_date));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCalendars]);  // intentionally not including activeTab to avoid loop

  // Fetch academic years on mount (needed as soon as schedule mode is toggled)
  useEffect(() => {
    getAcademicYears().then((years) => {
      setAcademicYears(years);
      const current = years.find((y) => y.is_current) || years[0];
      if (current) setSelectedAcademicYearId(current.id);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build month string "YYYY-MM" for current view
  const monthStr = useMemo(
    () => `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`,
    [currentMonth]
  );

  // Fetch schedule view data (one query per month, only in schedule mode)
  const activeCalendarForSchedule = activeTab === 'gregorian' ? gregorianCalendar : hijriCalendar;
  const { data: scheduleResp, isLoading: scheduleLoading, error: scheduleError } = useSWR(
    scheduleViewMode && schedulePluginActive && activeCalendarForSchedule?.id && selectedAcademicYearId
      ? ['schedule-view', activeCalendarForSchedule.id, selectedAcademicYearId, monthStr, campusId]
      : null,
    async () => {
      const res = await getCalendarScheduleView(activeCalendarForSchedule!.id, {
        academic_year_id: selectedAcademicYearId,
        month: monthStr,
        campus_id: campusId || null,
      });
      if (!res.success) {
        toast.error(res.error || 'Failed to load schedule');
      }
      return res;
    },
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  // Build per-date schedule entries map.
  // When scheduleViewMode is ON: always return a Record (even empty {}) so CalendarGrid
  // switches to schedule mode immediately on toggle — not undefined (which keeps events mode).
  const scheduleEntriesMap = useMemo<Record<string, ScheduleViewEntry[]> | undefined>(() => {
    if (!scheduleViewMode) return undefined;
    if (!scheduleResp?.data) return {};          // schedule mode active, data still loading

    const { calendar_days, schedule_by_dow } = scheduleResp.data;
    const map: Record<string, ScheduleViewEntry[]> = {};

    // Primary: use calendar_days which marks school-day vs holiday
    for (const [date, dayData] of Object.entries(calendar_days)) {
      map[date] = dayData.entries;
    }

    // Fallback: if attendance calendar days haven't been generated yet but timetable exists,
    // populate every date in the visible month from schedule_by_dow
    if (Object.keys(map).length === 0 && Object.keys(schedule_by_dow).length > 0) {
      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const jsDow = new Date(y, m, d).getDay();
        const ourDow = jsDow === 0 ? 6 : jsDow - 1;
        const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        map[dateKey] = schedule_by_dow[ourDow] || [];
      }
    }

    return map;
  }, [scheduleViewMode, scheduleResp, currentMonth]);

  // Use SWR hooks for data fetching with automatic caching
  const { events, isLoading, isValidating, mutate: mutateEvents } = useEvents({
    currentMonth,
    selectedCategory
  });

  // Get the active calendar based on current tab
  const activeCalendar = activeTab === 'gregorian' ? gregorianCalendar : hijriCalendar;
  
  // Pass calendar date range to category counts (if calendar is selected)
  const { categoryCounts, mutate: mutateCategoryCounts } = useCategoryCounts(
    activeCalendar?.start_date,
    activeCalendar?.end_date
  );

  // Helper to get month start/end in YYYY-MM-DD
  function getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  // Fetch calendar days for current month for each calendar type
  const { data: gregorianDays, isValidating: loadingGregorianDays } = useSWR(
    gregorianCalendar && currentMonth && gregorianCalendar.calendar_type === "gregorian"
      ? ["calendarDays", gregorianCalendar.id, currentMonth.toISOString().slice(0, 7)]
      : null,
    async () => {
      if (!gregorianCalendar) return [];
      const { start, end } = getMonthRange(currentMonth);
      const res = await getCalendarDays(gregorianCalendar.id, start, end);
      return res.success && res.data ? res.data : [];
    }
  );

  const { data: hijriDays, isValidating: loadingHijriDays } = useSWR(
    hijriCalendar && currentMonth && hijriCalendar.calendar_type === "hijri"
      ? ["calendarDays", hijriCalendar.id, currentMonth.toISOString().slice(0, 7)]
      : null,
    async () => {
      if (!hijriCalendar) return [];
      const { start, end } = getMonthRange(currentMonth);
      const res = await getCalendarDays(hijriCalendar.id, start, end);
      return res.success && res.data ? res.data : [];
    }
  );

  const handleAddEvent = (date?: Date) => {
    setSelectedEvent(null);
    setSelectedDate(date || null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setShowEventForm(true);
  };

  const handleDeleteEvent = (event: SchoolEvent) => {
    setEventToDelete(event);
    setShowDeleteDialog(true);
  };

  const handleEventClick = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  const handleDateClick = (date: Date) => {
    handleAddEvent(date);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      const response = await deleteEvent(eventToDelete.id);
      if (response.success) {
        toast.success("Event deleted successfully");
        // Invalidate cache to refetch latest data
        mutateEvents();
        mutateCategoryCounts();
      } else {
        toast.error(response.error || "Failed to delete event");
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("An error occurred while deleting the event");
    } finally {
      setShowDeleteDialog(false);
      setEventToDelete(null);
    }
  };

  const handleFormSuccess = () => {
    // Invalidate SWR cache to refetch latest data
    mutateEvents();
    mutateCategoryCounts();
    setSelectedDate(null);
  };

  const handleMonthChange = (date: Date) => {
    // SWR will automatically fetch new data for the new month
    // keepPreviousData ensures smooth transition
    setCurrentMonth(date);
  };

  // Attendance Calendar Management Handlers
  const handleEditCalendar = (calendar: AttendanceCalendar) => {
    setSelectedCalendar(calendar);
    const fromDate = new Date(calendar.start_date);
    const toDate = new Date(calendar.end_date);
    setFormData({
      title: calendar.title,

      is_default: calendar.is_default,
      from_day: fromDate.getDate().toString(),
      from_month: fromDate.getMonth().toString(),
      from_year: fromDate.getFullYear().toString(),
      to_day: toDate.getDate().toString(),
      to_month: toDate.getMonth().toString(),
      to_year: toDate.getFullYear().toString(),
      weekdays: calendar.weekdays,
      default_minutes: calendar.default_minutes.toString(),
    });
    setShowCalendarDialog(true);
  };

  const handleDeleteCalendar = (calendar: AttendanceCalendar) => {
    setCalendarToDelete(calendar);
    setShowDeleteCalendarDialog(true);
  };

  const handleSubmitCalendar = async () => {
    if (!selectedCalendar) {
      toast.error("No calendar selected for editing");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    const startDate = `${formData.from_year}-${String(parseInt(formData.from_month) + 1).padStart(2, '0')}-${String(formData.from_day).padStart(2, '0')}`;
    const endDate = `${formData.to_year}-${String(parseInt(formData.to_month) + 1).padStart(2, '0')}-${String(formData.to_day).padStart(2, '0')}`;

    const payload = {
      title: formData.title,
      calendar_type: activeTab,
      start_date: startDate,
      end_date: endDate,
      weekdays: formData.weekdays,
      default_minutes: parseInt(formData.default_minutes) || 360,
      is_default: formData.is_default,
    };

    const res = await updateCalendar(selectedCalendar.id, payload);

    if (res.success) {
      toast.success("Calendar updated");
      setShowCalendarDialog(false);
      // Jump the grid to the new start month so the user immediately sees the updated range
      setCurrentMonth(new Date(startDate));
      mutateCalendars();
    } else {
      toast.error(res.error || "Failed to update calendar");
    }
    setSaving(false);
  };

  const confirmDeleteCalendar = async () => {
    if (!calendarToDelete) return;
    setSaving(true);
    const res = await deleteCalendar(calendarToDelete.id);
    if (res.success) {
      toast.success("Calendar deleted");
      setShowDeleteCalendarDialog(false);
      mutateCalendars();
    } else {
      toast.error(res.error || "Failed to delete");
    }
    setSaving(false);
  };

  const handleCalendarDayClick = async (date: Date) => {
    // In schedule view mode: clicking a date opens the "add event" form
    if (scheduleViewMode) {
      handleAddEvent(date);
      return;
    }

    const currentCalendar = activeTab === 'gregorian' ? gregorianCalendar : hijriCalendar;
    if (!currentCalendar) {
      // If no calendar, allow adding event
      handleAddEvent(date);
      return;
    }

    // Toggle school day status
    const dateStr = moment(date).format('YYYY-MM-DD');
    const days = activeTab === 'gregorian' ? gregorianDays : hijriDays;
    const day = days?.find(d => d.school_date === dateStr);
    if (!day) return;

    const res = await toggleCalendarDay(currentCalendar.id, day.id, !day.is_school_day);
    if (res.success) {
      // Mutate the calendar days cache
      mutate(['calendarDays', currentCalendar.id, currentMonth.toISOString().slice(0, 7)]);
      toast.success(res.data.is_school_day ? "Marked as school day" : "Marked as no school");
    } else {
      toast.error(res.error || "Failed to toggle day");
    }
  };

  const getCategoryIcon = (category: EventCategory) => {
    switch (category) {
      case "academic":
        return <BookOpen className="h-4 w-4" />;
      case "holiday":
        return <CalendarBadge className="h-4 w-4" />;
      case "exam":
        return <FileText className="h-4 w-4" />;
      case "meeting":
        return <Users className="h-4 w-4" />;
      case "activity":
        return <Zap className="h-4 w-4" />;
      case "reminder":
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            School Events & Calendar
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Manage academic events, holidays, and important dates with dual calendar support
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/events/list')}
          >
            <List className="mr-2 h-4 w-4" />
            All Events
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/events/calendars/new')}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Calendar
          </Button>
          <Button
            className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
            onClick={() => handleAddEvent()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([category, label]) => (
          <Card 
            key={category} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedCategory === category ? "ring-2 ring-[#022172]" : ""
            }`}
            onClick={() => setSelectedCategory(selectedCategory === category ? "all" : category)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: EVENT_COLORS[category] + "20",
                    color: EVENT_COLORS[category]
                  }}
                >
                  {getCategoryIcon(category)}
                </div>
                <div>
                  <div className="text-2xl font-bold">{categoryCounts[category]}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar Tabs */}
      <Tabs defaultValue="gregorian" className="w-full" onValueChange={(v) => setActiveTab(v as 'gregorian' | 'hijri')}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="gregorian">Gregorian Calendar</TabsTrigger>
            <TabsTrigger value="hijri">Hijri Calendar</TabsTrigger>
          </TabsList>
        </div>

        {/* Schedule View toggle + academic year selector (shown when plugin is active) */}
        {schedulePluginActive && (
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <button
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              onClick={() => setScheduleViewMode((v) => !v)}
            >
              <CalendarDays className="w-4 h-4" />
              {scheduleViewMode ? 'Events and Assignments View' : 'Schedule View'}
            </button>
            {icalPluginActive && (
              <Popover open={showIcalPopover} onOpenChange={(o) => { setShowIcalPopover(o); if (o) { fetchIcalLink('events'); if (schedulePluginActive) fetchIcalLink('schedule'); } }}>
                <PopoverTrigger asChild>
                  <button className="text-sm text-green-700 hover:underline flex items-center gap-1 ml-2">
                    <CalendarRange className="w-4 h-4" />
                    iCalendar
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-4" align="start">
                  <p className="text-sm font-semibold">iCalendar</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Download</strong> the .ics file directly, or <strong>copy the link</strong> to subscribe in Google Calendar, Outlook, or any app that supports .ics feeds.
                  </p>
                  {/* Events link */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">School Events</p>
                    <div className="flex items-center gap-1.5">
                      <input readOnly value={icalUrls.events || (icalLoading === 'events' ? 'Generating…' : '—')} className="flex-1 text-xs border rounded px-2 py-1 bg-muted/30 truncate" />
                      {/* Download button */}
                      <button
                        onClick={() => downloadIcal('events')}
                        disabled={icalLoading === 'events'}
                        className="shrink-0 p-1.5 rounded border hover:bg-muted disabled:opacity-50"
                        title="Download .ics"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {/* Copy button */}
                      <button onClick={() => copyIcalLink('events')} className="shrink-0 p-1.5 rounded border hover:bg-muted" title="Copy subscribe link">
                        {icalCopied === 'events' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {/* Schedule link (only if schedule plugin also active) */}
                  {schedulePluginActive && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Class Schedule</p>
                      <div className="flex items-center gap-1.5">
                        <input readOnly value={icalUrls.schedule || (icalLoading === 'schedule' ? 'Generating…' : '—')} className="flex-1 text-xs border rounded px-2 py-1 bg-muted/30 truncate" />
                        <button
                          onClick={() => downloadIcal('schedule')}
                          disabled={icalLoading === 'schedule'}
                          className="shrink-0 p-1.5 rounded border hover:bg-muted disabled:opacity-50"
                          title="Download .ics"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => copyIcalLink('schedule')} className="shrink-0 p-1.5 rounded border hover:bg-muted" title="Copy subscribe link">
                          {icalCopied === 'schedule' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {scheduleViewMode && academicYears.length > 0 && (
              <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
                <SelectTrigger className="h-7 w-36 text-xs">
                  <SelectValue placeholder="Academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id} className="text-xs">
                      {y.name}{y.is_current ? ' (Current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scheduleViewMode && scheduleLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">Loading schedule…</span>
            )}
          </div>
        )}

        <TabsContent value="gregorian" className="mt-6">
          {/* Calendar Selector */}
          {allCalendars && allCalendars.filter(c => c.calendar_type === 'gregorian').length > 0 && (
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <Label>Attendance Calendar:</Label>
              <Select
                value={gregorianCalendar?.id || ''}
                onValueChange={(id) => setGregorianCalendar(allCalendars?.find(c => c.id === id) || null)}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  {allCalendars.filter(c => c.calendar_type === 'gregorian').map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.title} {cal.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {gregorianCalendar && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleEditCalendar(gregorianCalendar)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCalendar(gregorianCalendar)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Info className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2 text-sm">
                        <p><strong>Calendar:</strong> {gregorianCalendar.title}</p>
                        <p><strong>Period:</strong> {gregorianCalendar.start_date} to {gregorianCalendar.end_date}</p>
                        <p><strong>Default Minutes:</strong> {gregorianCalendar.default_minutes}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click any date to toggle school day / no school. Green = school day, Pink = no school.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          )}

          {isLoading || loadingGregorianDays ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading calendar...
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {(isValidating || loadingGregorianDays) && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                      Updating...
                    </div>
                  </div>
                </div>
              )}
              <CalendarGrid
                events={events}
                calendarDays={gregorianDays || []}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDateClick={handleCalendarDayClick}
                onEventClick={handleEventClick}
                calendarType="gregorian"
                calendarStart={gregorianCalendar?.start_date}
                calendarEnd={gregorianCalendar?.end_date}
                scheduleEntries={activeTab === 'gregorian' ? scheduleEntriesMap : undefined}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="hijri" className="mt-6">
          {/* Calendar Selector */}
          {allCalendars && allCalendars.filter(c => c.calendar_type === 'hijri').length > 0 && (
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <Label>Attendance Calendar:</Label>
              <Select
                value={hijriCalendar?.id || ''}
                onValueChange={(id) => setHijriCalendar(allCalendars?.find(c => c.id === id) || null)}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  {allCalendars.filter(c => c.calendar_type === 'hijri').map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.title} {cal.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hijriCalendar && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => handleEditCalendar(hijriCalendar)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCalendar(hijriCalendar)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Info className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2 text-sm">
                        <p><strong>Calendar:</strong> {hijriCalendar.title}</p>
                        <p><strong>Period:</strong> {hijriCalendar.start_date} to {hijriCalendar.end_date}</p>
                        <p><strong>Default Minutes:</strong> {hijriCalendar.default_minutes}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click any date to toggle school day / no school. Green = school day, Pink = no school.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          )}

          {isLoading || loadingHijriDays ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading calendar...
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {(isValidating || loadingHijriDays) && (
                <div className="absolute top-2 right-2 z-10">
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                      Updating...
                    </div>
                  </div>
                </div>
              )}
              <CalendarGrid
                events={events}
                calendarDays={hijriDays || []}
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDateClick={handleCalendarDayClick}
                onEventClick={handleEventClick}
                calendarType="hijri"
                calendarStart={hijriCalendar?.start_date}
                calendarEnd={hijriCalendar?.end_date}
                scheduleEntries={activeTab === 'hijri' ? scheduleEntriesMap : undefined}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Event Details Dialog */}
      <EventDetailsDialog
        open={showEventDetails}
        onOpenChange={setShowEventDetails}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Event Form Dialog */}
      <EventFormDialog
        open={showEventForm}
        onOpenChange={setShowEventForm}
        event={selectedEvent}
        onSuccess={handleFormSuccess}
        initialDate={selectedDate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{eventToDelete?.title}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calendar Management Dialog */}
      <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Title */}
            <div>
              <Label className="text-red-500">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter calendar title"
              />
            </div>

            {/* Default */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label>Default Calendar for this School</Label>
            </div>

            {/* From Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-red-500">From</Label>
                <div className="flex gap-2">
                  <Select value={formData.from_day} onValueChange={(v) => setFormData({ ...formData, from_day: v })}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formData.from_month} onValueChange={(v) => setFormData({ ...formData, from_month: v })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                        <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.from_year} onValueChange={(v) => setFormData({ ...formData, from_year: v })}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* To Date */}
              <div>
                <Label className="text-red-500">To</Label>
                <div className="flex gap-2">
                  <Select value={formData.to_day} onValueChange={(v) => setFormData({ ...formData, to_day: v })}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formData.to_month} onValueChange={(v) => setFormData({ ...formData, to_month: v })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                        <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.to_year} onValueChange={(v) => setFormData({ ...formData, to_year: v })}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Weekdays */}
            <div className="space-y-2">
              <Label>School Days</Label>
              <div className="flex flex-wrap gap-4">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Switch
                      checked={formData.weekdays[i]}
                      onCheckedChange={(checked) => {
                        const newWeekdays = [...formData.weekdays];
                        newWeekdays[i] = checked;
                        setFormData({ ...formData, weekdays: newWeekdays });
                      }}
                    />
                    <Label>{day}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <Label className="flex items-center gap-1">
                Minutes <Info className="w-4 h-4 text-muted-foreground" />
              </Label>
              <Input
                type="number"
                value={formData.default_minutes}
                onChange={(e) => setFormData({ ...formData, default_minutes: e.target.value })}
                placeholder="360"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default full-day minutes for school days
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCalendarDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCalendar} disabled={saving}>
              {saving ? 'Saving...' : 'OK'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Calendar Dialog */}
      <AlertDialog open={showDeleteCalendarDialog} onOpenChange={setShowDeleteCalendarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{calendarToDelete?.title}&rdquo;? This will also delete all calendar days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCalendar} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
