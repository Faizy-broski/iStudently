"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Search, Edit, Trash2, BookOpen, FileText,
  Users, Zap, Bell, Calendar as CalendarBadge, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EventFormDialog } from "@/components/admin/EventFormDialog";
import { EventDetailsDialog } from "@/components/admin/EventDetailsDialog";
import { deleteEvent, getEvents, type SchoolEvent, type EventCategory } from "@/lib/api/events";
import { useCampus } from "@/context/CampusContext";
import { toast } from "sonner";
import useSWR from "swr";
import moment from "moment";

const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: "Academic",
  holiday: "Holiday",
  exam: "Exam",
  meeting: "Meeting",
  activity: "Activity",
  reminder: "Reminder",
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  academic: "bg-blue-100 text-blue-700",
  holiday: "bg-red-100 text-red-700",
  exam: "bg-amber-100 text-amber-700",
  meeting: "bg-purple-100 text-purple-700",
  activity: "bg-emerald-100 text-emerald-700",
  reminder: "bg-gray-100 text-gray-700",
};

const CATEGORY_ICONS: Record<EventCategory, React.ReactNode> = {
  academic: <BookOpen className="h-3.5 w-3.5" />,
  holiday: <CalendarBadge className="h-3.5 w-3.5" />,
  exam: <FileText className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  activity: <Zap className="h-3.5 w-3.5" />,
  reminder: <Bell className="h-3.5 w-3.5" />,
};

const PAGE_SIZE = 20;

export default function AllEventsPage() {
  const router = useRouter();
  const campusContext = useCampus();
  const campusId = campusContext?.selectedCampus?.id;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [sortBy, setSortBy] = useState<"date_asc" | "date_desc">("date_asc");
  const [page, setPage] = useState(1);

  // Event dialog states
  const [showEventForm, setShowEventForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SchoolEvent | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<SchoolEvent | null>(null);

  const { data, isLoading, mutate } = useSWR(
    ["all-events", campusId, categoryFilter],
    async () => {
      const res = await getEvents({
        campus_id: campusId,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        limit: 500,
      });
      return res.success && res.data ? res.data : [];
    },
    { revalidateOnFocus: false }
  );

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      return sortBy === "date_asc" ? diff : -diff;
    });
    return list;
  }, [data, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleEdit = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setShowEventForm(true);
  };

  const handleDelete = (event: SchoolEvent) => {
    setEventToDelete(event);
    setShowDeleteDialog(true);
  };

  const handleView = (event: SchoolEvent) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    const res = await deleteEvent(eventToDelete.id);
    if (res.success) {
      toast.success("Event deleted");
      mutate();
    } else {
      toast.error(res.error || "Failed to delete event");
    }
    setShowDeleteDialog(false);
    setEventToDelete(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/events")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
              All Events
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${filtered.length} event${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button
          className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
          onClick={() => { setSelectedEvent(null); setShowEventForm(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v as EventCategory | "all"); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.entries(CATEGORY_LABELS) as [EventCategory, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_asc">Date: Oldest first</SelectItem>
            <SelectItem value="date_desc">Date: Newest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading events…</div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Start</th>
                    <th className="text-left px-4 py-3 font-medium">End</th>
                    <th className="text-left px-4 py-3 font-medium">Visible To</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((event, idx) => (
                    <tr
                      key={event.id}
                      className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      onClick={() => handleView(event)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: event.color_code || "#6b7280" }}
                          />
                          <span className="font-medium">{event.title}</span>
                          {event.is_all_day && (
                            <Badge variant="outline" className="text-xs">All day</Badge>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 pl-4">{event.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${CATEGORY_COLORS[event.category]} border-0 gap-1 font-normal`}>
                          {CATEGORY_ICONS[event.category]}
                          {CATEGORY_LABELS[event.category]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {moment(event.start_at).format("DD MMM YYYY")}
                        {!event.is_all_day && (
                          <span className="block text-xs">{moment(event.start_at).format("h:mm A")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {moment(event.end_at).format("DD MMM YYYY")}
                        {!event.is_all_day && (
                          <span className="block text-xs">{moment(event.end_at).format("h:mm A")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {event.visible_to_roles.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs capitalize">{r}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(event)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(event)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <EventDetailsDialog
        open={showEventDetails}
        onOpenChange={setShowEventDetails}
        event={selectedEvent}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <EventFormDialog
        open={showEventForm}
        onOpenChange={setShowEventForm}
        event={selectedEvent}
        onSuccess={() => mutate()}
      />

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
