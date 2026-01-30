"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createEvent, updateEvent, type SchoolEvent, type EventCategory, type CreateEventDTO } from "@/lib/api/events";
import { getGradeLevels, type GradeLevel } from "@/lib/api/academics";

const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().optional(),
  category: z.enum(["academic", "holiday", "exam", "meeting", "activity", "reminder"]),
  start_at: z.string().min(1, "Start date is required"),
  end_at: z.string().optional(),
  is_all_day: z.boolean().default(true),
  color_code: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color code"),
  target_grades: z.array(z.string()).optional(),
  visible_to_roles: z.array(z.string()).min(1, "At least one role must be selected"),
  send_reminder: z.boolean().default(false),
  reminder_days_before: z.number().min(0).max(30).optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const CATEGORY_OPTIONS: { value: EventCategory; label: string; color: string }[] = [
  { value: "academic", label: "Academic", color: "#3b82f6" },
  { value: "holiday", label: "Holiday", color: "#ef4444" },
  { value: "exam", label: "Exam", color: "#f59e0b" },
  { value: "meeting", label: "Meeting", color: "#8b5cf6" },
  { value: "activity", label: "Activity", color: "#10b981" },
  { value: "reminder", label: "Reminder", color: "#6b7280" },
];

const ROLE_OPTIONS = [
  { value: "teacher", label: "Teachers" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
];

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: SchoolEvent | null;
  onSuccess?: () => void;
  initialDate?: Date | null;
}

export function EventFormDialog({ open, onOpenChange, event, onSuccess, initialDate }: EventFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [selectAllGrades, setSelectAllGrades] = useState(false);
  const isEditing = !!event;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "academic",
      start_at: "",
      end_at: "",
      is_all_day: true,
      color_code: "#3b82f6",
      target_grades: [],
      visible_to_roles: ["teacher", "student", "parent"],
      send_reminder: false,
      reminder_days_before: 1,
    },
  });

  // Fetch grade levels on mount
  useEffect(() => {
    const fetchGrades = async () => {
      setIsLoadingGrades(true);
      try {
        const response = await getGradeLevels();
        if (response.success && response.data) {
          // Sort by order_index
          const sortedGrades = response.data
            .filter(g => g.is_active)
            .sort((a, b) => a.order_index - b.order_index);
          setGradeLevels(sortedGrades);
        }
      } catch (error) {
        console.error('Failed to fetch grade levels:', error);
      } finally {
        setIsLoadingGrades(false);
      }
    };
    fetchGrades();
  }, []);

  // Update form when event changes
  useEffect(() => {
    if (event) {
      // Convert ISO string to datetime-local format
      const formatDateTimeLocal = (isoString: string) => {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      form.reset({
        title: event.title,
        description: event.description || "",
        category: event.category,
        start_at: formatDateTimeLocal(event.start_at),
        end_at: event.end_at ? formatDateTimeLocal(event.end_at) : "",
        is_all_day: event.is_all_day,
        color_code: event.color_code,
        target_grades: event.target_grades || [],
        visible_to_roles: event.visible_to_roles.filter(role => role !== 'superadmin' && role !== 'admin') as string[],
        send_reminder: event.send_reminder || false,
        reminder_days_before: 1,
      });
      // Check if all grades are selected
      if (event.target_grades && event.target_grades.length === gradeLevels.length) {
        setSelectAllGrades(true);
      }
    } else if (initialDate) {
      // If no event but initial date provided, prefill the date
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      form.reset({
        title: "",
        description: "",
        category: "academic",
        start_at: dateString,
        end_at: "",
        is_all_day: true,
        color_code: "#3b82f6",
        target_grades: [],
        visible_to_roles: ["teacher", "student", "parent"],
        send_reminder: false,
        reminder_days_before: 1,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        category: "academic",
        start_at: "",
        end_at: "",
        is_all_day: true,
        color_code: "#3b82f6",
        target_grades: [],
        visible_to_roles: ["teacher", "student", "parent"],
        send_reminder: false,
        reminder_days_before: 1,
      });
    }
  }, [event, initialDate, form, gradeLevels]);

  const onSubmit = async (values: EventFormValues) => {
    setIsSubmitting(true);

    try {
      const eventData: CreateEventDTO = {
        title: values.title,
        description: values.description,
        category: values.category,
        start_at: new Date(values.start_at).toISOString(),
        end_at: values.end_at ? new Date(values.end_at).toISOString() : new Date(values.start_at).toISOString(),
        is_all_day: values.is_all_day,
        color_code: values.color_code,
        target_grades: values.target_grades && values.target_grades.length > 0 ? values.target_grades : undefined,
        visible_to_roles: values.visible_to_roles as any,
        send_reminder: values.send_reminder,
      };

      const response = isEditing
        ? await updateEvent(event.id, eventData)
        : await createEvent(eventData);

      if (response.success) {
        toast.success(isEditing ? "Event updated successfully" : "Event created successfully");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(response.error || "Failed to save event");
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("An error occurred while saving the event");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update color when category changes
  const handleCategoryChange = (category: EventCategory) => {
    const categoryOption = CATEGORY_OPTIONS.find((opt) => opt.value === category);
    if (categoryOption) {
      form.setValue("color_code", categoryOption.color);
    }
  };

  const isAllDay = form.watch("is_all_day");
  const sendReminder = form.watch("send_reminder");
  const targetGrades = form.watch("target_grades");

  // Handle Select All grades
  const handleSelectAllGrades = (checked: boolean) => {
    setSelectAllGrades(checked);
    if (checked) {
      form.setValue("target_grades", gradeLevels.map(g => g.name));
    } else {
      form.setValue("target_grades", []);
    }
  };

  // Update selectAllGrades when individual grades change
  useEffect(() => {
    if (targetGrades && gradeLevels.length > 0) {
      setSelectAllGrades(targetGrades.length === gradeLevels.length);
    }
  }, [targetGrades, gradeLevels]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "Add New Event"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update event details" : "Create a new event for the school calendar"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter event description (optional)"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category and Color */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        handleCategoryChange(value as EventCategory);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: option.color }}
                              />
                              {option.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input type="color" {...field} className="w-16 h-10" />
                        <Input
                          type="text"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date/Time */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="is_all_day"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">All-day event</FormLabel>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start {isAllDay ? "Date" : "Date & Time"} *</FormLabel>
                      <FormControl>
                        <Input
                          type={isAllDay ? "date" : "datetime-local"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End {isAllDay ? "Date" : "Date & Time"}</FormLabel>
                      <FormControl>
                        <Input
                          type={isAllDay ? "date" : "datetime-local"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Target Grades */}
            <FormField
              control={form.control}
              name="target_grades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Grades (Optional)</FormLabel>
                  <FormDescription>Leave empty to show to all grades</FormDescription>
                  {isLoadingGrades ? (
                    <div className="text-sm text-muted-foreground py-2">Loading grades...</div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {/* Select All Option */}
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Checkbox
                          checked={selectAllGrades}
                          onCheckedChange={handleSelectAllGrades}
                          id="grade-all"
                        />
                        <Label htmlFor="grade-all" className="cursor-pointer font-medium">
                          All Grades
                        </Label>
                      </div>
                      
                      {/* Individual Grades */}
                      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                        {gradeLevels.map((grade) => (
                          <div key={grade.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={field.value?.includes(grade.name)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, grade.name]);
                                } else {
                                  field.onChange(current.filter((g) => g !== grade.name));
                                }
                              }}
                              id={`grade-${grade.id}`}
                            />
                            <Label htmlFor={`grade-${grade.id}`} className="cursor-pointer text-sm">
                              {grade.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Visible to Roles */}
            <FormField
              control={form.control}
              name="visible_to_roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visible to Roles *</FormLabel>
                  <FormDescription>Select who can see this event</FormDescription>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                    {ROLE_OPTIONS.map((role) => (
                      <div key={role.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={field.value?.includes(role.value)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, role.value]);
                            } else {
                              field.onChange(current.filter((r) => r !== role.value));
                            }
                          }}
                          id={`role-${role.value}`}
                        />
                        <Label htmlFor={`role-${role.value}`} className="cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reminder */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="send_reminder"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">Send reminder notification</FormLabel>
                  </FormItem>
                )}
              />

              {sendReminder && (
                <FormField
                  control={form.control}
                  name="reminder_days_before"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remind how many days before?</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
              >
                {isSubmitting ? "Saving..." : isEditing ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
