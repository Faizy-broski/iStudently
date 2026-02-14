"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getStats,
  getRecords,
  getCheckpoints,
  createRecord,
  searchStudents,
} from "@/lib/api/entry-exit";
import { EntryExitStats, EntryExitRecord, Checkpoint } from "@/types";
import {
  DoorOpen,
  DoorClosed,
  Users,
  Package,
  Plus,
  ArrowRightLeft,
  Clock,
  Search,
} from "lucide-react";

export default function EntryExitDashboard() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [stats, setStats] = useState<EntryExitStats>({
    entries: 0,
    exits: 0,
    inside: 0,
    packages: 0,
  });
  const [recentRecords, setRecentRecords] = useState<EntryExitRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick record form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState("");
  const [personType, setPersonType] = useState("STUDENT");
  const [recordType, setRecordType] = useState("ENTRY");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Student search
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (schoolId) loadData();
  }, [schoolId]);

  async function loadData() {
    try {
      setLoading(true);
      const [statsData, recordsData, checkpointsData] = await Promise.all([
        getStats(schoolId),
        getRecords({ school_id: schoolId, limit: 10 }),
        getCheckpoints(schoolId),
      ]);
      setStats(statsData);
      setRecentRecords(recordsData);
      setCheckpoints(checkpointsData);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStudentSearch(query: string) {
    setStudentSearch(query);
    if (query.length < 2) {
      setStudents([]);
      return;
    }
    try {
      setSearchingStudents(true);
      const results = await searchStudents(schoolId, query);
      setStudents(Array.isArray(results) ? results : []);
    } catch {
      setStudents([]);
    } finally {
      setSearchingStudents(false);
    }
  }

  function selectPerson(student: any) {
    setSelectedPersonId(student.id);
    const name =
      `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
      `${student.profiles?.first_name || ""} ${student.profiles?.last_name || ""}`.trim() ||
      student.admission_number ||
      student.id;
    setSelectedPersonName(name);
    setStudentSearch("");
    setStudents([]);
  }

  async function handleQuickRecord() {
    if (!selectedCheckpoint || !selectedPersonId) return;
    try {
      setSubmitting(true);
      await createRecord({
        school_id: schoolId,
        checkpoint_id: selectedCheckpoint,
        person_id: selectedPersonId,
        person_type: personType,
        record_type: recordType,
        description: description || undefined,
      });
      setDialogOpen(false);
      setSelectedCheckpoint("");
      setSelectedPersonId("");
      setSelectedPersonName("");
      setDescription("");
      loadData();
    } catch (err) {
      console.error("Failed to create record:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const statCards = [
    {
      title: "Entries Today",
      value: stats.entries,
      icon: DoorOpen,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Exits Today",
      value: stats.exits,
      icon: DoorClosed,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      title: "Currently Inside",
      value: stats.inside,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Pending Packages",
      value: stats.packages,
      icon: Package,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entry & Exit</h1>
          <p className="text-muted-foreground">
            Track entries, exits, and manage access checkpoints
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Quick Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>Record Entry / Exit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Checkpoint</Label>
                <Select
                  value={selectedCheckpoint}
                  onValueChange={setSelectedCheckpoint}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select checkpoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {checkpoints.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Person Type</Label>
                  <Select value={personType} onValueChange={setPersonType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={recordType} onValueChange={setRecordType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRY">Entry</SelectItem>
                      <SelectItem value="EXIT">Exit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Searchable student/staff selector */}
              <div className="space-y-2">
                <Label>
                  {personType === "STUDENT" ? "Student" : "Staff Member"}
                </Label>
                {selectedPersonId ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">
                      {selectedPersonName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPersonId("");
                        setSelectedPersonName("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or admission number..."
                      className="pl-9"
                      value={studentSearch}
                      onChange={(e) => handleStudentSearch(e.target.value)}
                    />
                    {students.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                        {students.map((s: any) => (
                          <button
                            key={s.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-0"
                            onClick={() => selectPerson(s)}
                          >
                            <div className="font-medium">
                              {s.first_name || s.profiles?.first_name}{" "}
                              {s.last_name || s.profiles?.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.admission_number &&
                                `ID: ${s.admission_number}`}
                              {s.class_name && ` · ${s.class_name}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchingStudents && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-sm text-muted-foreground text-center">
                        Searching...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>

              <Button
                onClick={handleQuickRecord}
                disabled={
                  submitting || !selectedCheckpoint || !selectedPersonId
                }
                className="w-full"
              >
                {submitting ? "Recording..." : "Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Records */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-semibold">
            Recent Activity
          </CardTitle>
          <a
            href="/admin/entry-exit/report"
            className="text-sm text-primary hover:underline"
          >
            View all →
          </a>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : recentRecords.length === 0 ? (
            <div className="text-center py-8">
              <ArrowRightLeft className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No records yet today</p>
              <p className="text-sm text-muted-foreground/60">
                Records will appear here as entries and exits are logged
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {recentRecords.map((record) => (
                <div key={record.id} className="flex items-center gap-3 py-3">
                  <div
                    className={`p-2 rounded-lg ${
                      record.record_type === "ENTRY"
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : "bg-orange-50 dark:bg-orange-950/30"
                    }`}
                  >
                    {record.record_type === "ENTRY" ? (
                      <DoorOpen className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <DoorClosed className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {record.person_name || record.person_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.person_type} ·{" "}
                      {record.checkpoint_name || record.checkpoint_id}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        record.status === "authorized"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : record.status === "late"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {record.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {new Date(record.recorded_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
