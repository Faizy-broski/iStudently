"use client";

import { useState } from "react";
import { Plus, BookOpen, FileText, Users, Zap, Bell, Calendar as CalendarBadge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  deleteEvent,
  type SchoolEvent,
  type EventCategory 
} from "@/lib/api/events";
import { EventFormDialog } from "@/components/admin/EventFormDialog";
import { CalendarGrid } from "@/components/admin/CalendarGrid";
import { EventDetailsDialog } from "@/components/admin/EventDetailsDialog";
import { useEvents, useCategoryCounts } from "@/hooks/useEvents";
import { toast } from "sonner";

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
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SchoolEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Use SWR hooks for data fetching with automatic caching
  const { events, isLoading, isValidating, mutate: mutateEvents } = useEvents({
    currentMonth,
    selectedCategory
  });
  
  const { categoryCounts, mutate: mutateCategoryCounts } = useCategoryCounts();

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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            School Events & Calendar
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Manage academic events, holidays, and important dates with dual calendar support
          </p>
        </div>
        <Button 
          className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
          onClick={() => handleAddEvent()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
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
      <Tabs defaultValue="gregorian" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="gregorian">Gregorian Calendar</TabsTrigger>
          <TabsTrigger value="hijri">Hijri Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="gregorian" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading calendar...
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {isValidating && (
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
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDateClick={handleDateClick}
                onEventClick={handleEventClick}
                calendarType="gregorian"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="hijri" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading calendar...
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {isValidating && (
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
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                onDateClick={handleDateClick}
                onEventClick={handleEventClick}
                calendarType="hijri"
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
    </div>
  );
}
