"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getRecords,
  getCheckpoints,
  createRecord,
  searchStudents,
} from "@/lib/api/entry-exit";
import { EntryExitRecord, Checkpoint } from "@/types";
import {
  Plus,
  Filter,
  Search,
  Users,
  DoorOpen,
  DoorClosed,
  Clock,
} from "lucide-react";

export default function RecordsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [records, setRecords] = useState<EntryExitRecord[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCheckpoint, setFilterCheckpoint] = useState("all");
  const [filterPersonType, setFilterPersonType] = useState("all");
  const [filterRecordType, setFilterRecordType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Add record dialog
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
    if (schoolId) {
      getCheckpoints(schoolId).then(setCheckpoints).catch(console.error);
    }
  }, [schoolId]);

  useEffect(() => {
    if (schoolId) loadRecords();
  }, [
    schoolId,
    filterCheckpoint,
    filterPersonType,
    filterRecordType,
    filterStatus,
    filterDateFrom,
    filterDateTo,
  ]);

  async function loadRecords() {
    try {
      setLoading(true);
      const data = await getRecords({
        school_id: schoolId,
        checkpoint_id:
          filterCheckpoint !== "all" ? filterCheckpoint : undefined,
        person_type: filterPersonType !== "all" ? filterPersonType : undefined,
        record_type: filterRecordType !== "all" ? filterRecordType : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setRecords(data);
    } catch (err) {
      console.error("Failed to load records:", err);
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
      `${student.first_name || student.profiles?.first_name || ""} ${student.last_name || student.profiles?.last_name || ""}`.trim() ||
      student.admission_number ||
      student.id;
    setSelectedPersonName(name);
    setStudentSearch("");
    setStudents([]);
  }

  async function handleAddRecord() {
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
      resetForm();
      loadRecords();
    } catch (err) {
      console.error("Failed to create record:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedCheckpoint("");
    setSelectedPersonId("");
    setSelectedPersonName("");
    setDescription("");
    setStudentSearch("");
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "authorized":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100">
            Authorized
          </Badge>
        );
      case "late":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 hover:bg-amber-100">
            Late
          </Badge>
        );
      case "unauthorized":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-100">
            Unauthorized
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Entry / Exit Records
          </h1>
          <p className="text-muted-foreground">
            View and manage all entry and exit records
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Record</DialogTitle>
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
                      placeholder="Search by name, ID, or admission no..."
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
                onClick={handleAddRecord}
                disabled={
                  submitting || !selectedCheckpoint || !selectedPersonId
                }
                className="w-full"
              >
                {submitting ? "Recording..." : "Add Record"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Select
              value={filterCheckpoint}
              onValueChange={setFilterCheckpoint}
            >
              <SelectTrigger>
                <SelectValue placeholder="Checkpoint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Checkpoints</SelectItem>
                {checkpoints.map((cp) => (
                  <SelectItem key={cp.id} value={cp.id}>
                    {cp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterPersonType}
              onValueChange={setFilterPersonType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Person Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterRecordType}
              onValueChange={setFilterRecordType}
            >
              <SelectTrigger>
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="ENTRY">Entry</SelectItem>
                <SelectItem value="EXIT">Exit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="authorized">Authorized</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="unauthorized">Unauthorized</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="From"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading records...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <DoorOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No records found</p>
              <p className="text-sm text-muted-foreground/60">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Checkpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                          record.record_type === "ENTRY"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                        }`}
                      >
                        {record.record_type === "ENTRY" ? (
                          <DoorOpen className="h-3 w-3" />
                        ) : (
                          <DoorClosed className="h-3 w-3" />
                        )}
                        {record.record_type}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {record.person_name || record.person_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {record.person_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.checkpoint_name ||
                        record.checkpoint_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(record.recorded_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                      {record.description || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
