"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Users, GraduationCap, Edit, Trash2 } from "lucide-react";
import moment from "moment";
import momentHijri from "moment-hijri";
import { type SchoolEvent } from "@/lib/api/events";

const HIJRI_OFFSET_KEY = "studently_global_hijri_offset";

const CATEGORY_LABELS: Record<string, string> = {
  academic: "Academic",
  holiday: "Holiday",
  exam: "Exam",
  meeting: "Meeting",
  activity: "Activity",
  reminder: "Reminder",
};

interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: SchoolEvent | null;
  onEdit?: (event: SchoolEvent) => void;
  onDelete?: (event: SchoolEvent) => void;
}

export function EventDetailsDialog({
  open,
  onOpenChange,
  event,
  onEdit,
  onDelete,
}: EventDetailsDialogProps) {
  const [globalHijriOffset, setGlobalHijriOffset] = useState<number>(0);

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

  if (!event) return null;

  const gregorianDate = moment(event.start_at).format("dddd, MMMM D, YYYY");
  
  // Apply global Hijri offset
  const hijriMoment = momentHijri(event.start_at);
  if (globalHijriOffset !== 0) {
    hijriMoment.add(globalHijriOffset, 'days');
  }
  const hijriDate = hijriMoment.format("idddd, iD iMMMM iYYYY");
  
  const startTime = !event.is_all_day
    ? moment(event.start_at).format("h:mm A")
    : null;
  const endTime =
    !event.is_all_day && event.end_at
      ? moment(event.end_at).format("h:mm A")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{event.title}</DialogTitle>
              <DialogDescription className="mt-2">
                {event.description || "No description provided"}
              </DialogDescription>
            </div>
            <Badge
              className="text-white"
              style={{ backgroundColor: event.color_code }}
            >
              {CATEGORY_LABELS[event.category]}
            </Badge>
          </div>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          {/* Gregorian Date */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-muted-foreground">
                Gregorian Date
              </div>
              <div className="text-lg">{gregorianDate}</div>
              {startTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="h-4 w-4" />
                  {startTime}
                  {endTime && ` - ${endTime}`}
                </div>
              )}
            </div>
          </div>

          {/* Hijri Date */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-muted-foreground">
                Hijri Date
              </div>
              <div className="text-lg">{hijriDate}</div>
              {globalHijriOffset !== 0 && (
                <Badge variant="outline" className="mt-1">
                  Global offset: {globalHijriOffset > 0 ? "+" : ""}
                  {globalHijriOffset} day
                </Badge>
              )}
            </div>
          </div>

          {/* Target Grades */}
          {event.target_grades && event.target_grades.length > 0 && (
            <div className="flex items-start gap-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-muted-foreground mb-2">
                  Target Grades
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.target_grades.map((grade) => (
                    <Badge key={grade} variant="outline">
                      Grade {grade}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Visible to Roles */}
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-muted-foreground mb-2">
                Visible to
              </div>
              <div className="flex flex-wrap gap-2">
                {event.visible_to_roles.map((role) => (
                  <Badge key={role} variant="secondary" className="capitalize">
                    {role.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Reminder Status */}
          {event.send_reminder && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">
                Reminder: {event.reminder_sent ? "Sent" : "Scheduled"}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(event);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          {onEdit && (
            <Button
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
              onClick={() => {
                onEdit(event);
                onOpenChange(false);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
