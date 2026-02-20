"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { createCalendar, getCalendars } from "@/lib/api/attendance-calendars";
import { useCampus } from "@/context/CampusContext";
import { toast } from "sonner";
import useSWR from "swr";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NewCalendarPage() {
  const router = useRouter();
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;
  
  const { data: calendars } = useSWR(
    ['attendance-calendars', campusId],
    async () => {
      const res = await getCalendars(campusId);
      return res.success ? res.data : [];
    }
  );
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    calendar_type: 'gregorian' as 'gregorian' | 'hijri',
    copy_from_calendar_id: 'none',
    is_default: false,
    from_day: '1',
    from_month: '0',
    from_year: new Date().getFullYear().toString(),
    to_day: '1',
    to_month: '0',
    to_year: (new Date().getFullYear() + 1).toString(),
    weekdays: [false, true, true, true, true, true, false], // Mon-Fri default
    default_minutes: '360'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const start_date = new Date(
      parseInt(formData.from_year),
      parseInt(formData.from_month),
      parseInt(formData.from_day)
    );
    const end_date = new Date(
      parseInt(formData.to_year),
      parseInt(formData.to_month),
      parseInt(formData.to_day)
    );

    if (end_date <= start_date) {
      toast.error("End date must be after start date");
      setSaving(false);
      return;
    }

    const res = await createCalendar({
      title: formData.title,
      calendar_type: formData.calendar_type,
      copy_from_calendar_id: formData.copy_from_calendar_id === 'none' ? null : formData.copy_from_calendar_id,
      is_default: formData.is_default,
      start_date: start_date.toISOString().split('T')[0],
      end_date: end_date.toISOString().split('T')[0],
      weekdays: formData.weekdays,
      default_minutes: parseInt(formData.default_minutes)
    });

    if (res.success) {
      toast.success("Calendar created successfully");
      router.push('/admin/events');
    } else {
      toast.error(res.error || "Failed to create calendar");
    }
    setSaving(false);
  };

  const getDayOptions = (month: number, year: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  };

  const fromDayOptions = getDayOptions(parseInt(formData.from_month), parseInt(formData.from_year));
  const toDayOptions = getDayOptions(parseInt(formData.to_month), parseInt(formData.to_year));

  const availableCalendarsForCopy = calendars?.filter(c => c.calendar_type === formData.calendar_type) || [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/admin/events')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Create New Calendar
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Set up a new attendance calendar for your school
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Calendar Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Academic Year 2024-2025"
                required
              />
            </div>

            {/* Calendar Type */}
            <div className="space-y-2">
              <Label htmlFor="calendar_type">Calendar Type</Label>
              <Select
                value={formData.calendar_type}
                onValueChange={(v: 'gregorian' | 'hijri') => setFormData({ ...formData, calendar_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gregorian">Gregorian</SelectItem>
                  <SelectItem value="hijri">Hijri</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Copy from existing calendar */}
            <div className="space-y-2">
              <Label htmlFor="copy_from">Copy From Existing Calendar (Optional)</Label>
              <Select
                value={formData.copy_from_calendar_id}
                onValueChange={(v) => setFormData({ ...formData, copy_from_calendar_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Start from scratch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N/A</SelectItem>
                  {availableCalendarsForCopy.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Set as default */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label htmlFor="is_default">Set as Default Calendar</Label>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <Label>Calendar Date Range</Label>
              
              {/* From Date */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">From</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={formData.from_month} onValueChange={(v) => setFormData({ ...formData, from_month: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.from_day} onValueChange={(v) => setFormData({ ...formData, from_day: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fromDayOptions.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.from_year} onValueChange={(v) => setFormData({ ...formData, from_year: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* To Date */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">To</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={formData.to_month} onValueChange={(v) => setFormData({ ...formData, to_month: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.to_day} onValueChange={(v) => setFormData({ ...formData, to_day: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toDayOptions.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formData.to_year} onValueChange={(v) => setFormData({ ...formData, to_year: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString()).map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Weekdays */}
            <div className="space-y-2">
              <Label>School Days (Select multiple)</Label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_LABELS.map((day, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    size="sm"
                    variant={formData.weekdays[idx] ? "default" : "outline"}
                    onClick={() => {
                      const newWeekdays = [...formData.weekdays];
                      newWeekdays[idx] = !newWeekdays[idx];
                      setFormData({ ...formData, weekdays: newWeekdays });
                    }}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            {/* Default Minutes */}
            <div className="space-y-2">
              <Label htmlFor="default_minutes">Default School Minutes per Day</Label>
              <Input
                id="default_minutes"
                type="number"
                min="1"
                max="1440"
                value={formData.default_minutes}
                onChange={(e) => setFormData({ ...formData, default_minutes: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Full day = 360 minutes (6 hours)</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving || !formData.title}>
                {saving ? "Creating..." : "Create Calendar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/events')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
