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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEveningLeaves,
  createEveningLeave,
  updateEveningLeave,
  deleteEveningLeave,
  getEveningLeaveReport,
  getCheckpoints,
  searchStudents,
} from "@/lib/api/entry-exit";
import { EveningLeave, Checkpoint } from "@/types";
import {
  Plus,
  Trash2,
  Moon,
  Search,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const DAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function EveningLeavesPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [leaves, setLeaves] = useState<EveningLeave[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("leaves");

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [returnTime, setReturnTime] = useState("21:00");
  const [reason, setReason] = useState("");
  const [selectedCheckpoint, setSelectedCheckpoint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Student search
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (schoolId) {
      getCheckpoints(schoolId).then(setCheckpoints).catch(console.error);
      loadData();
    }
  }, [schoolId]);

  useEffect(() => {
    if (schoolId && activeTab === "report") {
      loadReport();
    }
  }, [activeTab, schoolId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getEveningLeaves({ school_id: schoolId });
      setLeaves(data);
    } catch (err) {
      console.error("Failed to load evening leaves:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReport() {
    try {
      const data = await getEveningLeaveReport(schoolId);
      setReport(data);
    } catch (err) {
      console.error("Failed to load report:", err);
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

  function selectStudent(student: any) {
    setSelectedStudentId(student.id);
    const name =
      `${student.first_name || student.profile?.first_name || ""} ${student.last_name || student.profile?.last_name || ""}`.trim() ||
      student.student_number ||
      student.id;
    setSelectedStudentName(name);
    setStudentSearch("");
    setStudents([]);
  }

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleCreate() {
    if (!selectedStudentId || !startDate || !endDate || daysOfWeek.length === 0)
      return;
    try {
      setSubmitting(true);
      await createEveningLeave({
        school_id: schoolId,
        student_id: selectedStudentId,
        checkpoint_id:
          selectedCheckpoint && selectedCheckpoint !== "NULL"
            ? selectedCheckpoint
            : undefined,
        start_date: startDate,
        end_date: endDate,
        days_of_week: daysOfWeek,
        authorized_return_time: returnTime,
        reason: reason || undefined,
      });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to create evening leave:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this evening leave?")) return;
    try {
      await deleteEveningLeave(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  async function handleToggleActive(leave: EveningLeave) {
    try {
      await updateEveningLeave(leave.id, { is_active: !leave.is_active });
      loadData();
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  }

  function resetForm() {
    setSelectedStudentId("");
    setSelectedStudentName("");
    setStartDate("");
    setEndDate("");
    setDaysOfWeek([]);
    setReturnTime("21:00");
    setReason("");
    setSelectedCheckpoint("");
    setStudentSearch("");
  }

  function formatDays(days: number[]) {
    return days
      .sort()
      .map((d) => DAY_OPTIONS.find((o) => o.value === d)?.label || d)
      .join(", ");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evening Leaves</h1>
          <p className="text-muted-foreground">
            Manage student evening leave authorizations
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
              Add Evening Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg overflow-visible">
            <DialogHeader>
              <DialogTitle>Add Evening Leave</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Student search */}
              <div className="space-y-2">
                <Label>Student</Label>
                {selectedStudentId ? (
                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">
                      {selectedStudentName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedStudentId("");
                        setSelectedStudentName("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search student..."
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
                            onClick={() => selectStudent(s)}
                          >
                            <div className="font-medium">
                              {s.first_name || s.profile?.first_name}{" "}
                              {s.last_name || s.profile?.last_name}
                            </div>
                            {s.student_number && (
                              <div className="text-xs text-muted-foreground">
                                {` · ${s.student_number}`}
                              </div>
                            )}
                            {s.email && (
                              <div className="text-xs text-muted-foreground">
                                {` · ${s.email}`}
                              </div>
                            )}
                            {s.grade_level && (
                              <div className="text-xs text-muted-foreground">
                                {` · ${s.grade_level}`}
                              </div>
                            )}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        daysOfWeek.includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Authorized Return Time</Label>
                  <Input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Checkpoint (Optional)</Label>
                  <Select
                    value={selectedCheckpoint}
                    onValueChange={setSelectedCheckpoint}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NULL">Any Checkpoint</SelectItem>
                      {checkpoints.map((cp) => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Sports practice"
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={
                  submitting ||
                  !selectedStudentId ||
                  !startDate ||
                  !endDate ||
                  daysOfWeek.length === 0
                }
                className="w-full"
              >
                {submitting ? "Creating..." : "Create Evening Leave"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leaves" className="gap-1">
            <Moon className="h-3 w-3" />
            All Leaves
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1">
            <Clock className="h-3 w-3" />
            Tonight's Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaves" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading...
                </div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-12">
                  <Moon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">
                    No evening leaves configured
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Return By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">
                          {leave.student_name || leave.student_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(leave.start_date).toLocaleDateString()} –{" "}
                          {new Date(leave.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDays(leave.days_of_week)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {leave.authorized_return_time}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              leave.is_active
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-100"
                            }
                          >
                            {leave.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(leave)}
                            >
                              {leave.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(leave.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">
                Tonight's Evening Leave Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-300 mb-3" />
                  <p className="text-muted-foreground">
                    No active evening leaves for tonight
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {report.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div
                        className={`p-2 rounded-full ${
                          item.has_returned ? "bg-emerald-100" : "bg-amber-100"
                        }`}
                      >
                        {item.has_returned ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.student_name || item.student_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Return by: {item.authorized_return_time}
                          {item.reason && ` · ${item.reason}`}
                        </p>
                      </div>
                      <div className="text-right">
                        {item.has_returned ? (
                          <div>
                            <Badge
                              className={`${item.is_late ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} hover:bg-emerald-100`}
                            >
                              {item.is_late ? "Returned Late" : "Returned"}
                            </Badge>
                            {item.return_time && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(item.return_time).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            Not back yet
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
