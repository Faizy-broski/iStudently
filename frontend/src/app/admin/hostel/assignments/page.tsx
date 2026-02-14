"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAssignments,
  assignStudent,
  releaseStudent,
  getRooms,
  getBuildings,
  searchStudents,
} from "@/lib/api/hostel";
import { HostelRoomAssignment, HostelRoom, HostelBuilding } from "@/types";
import { Plus, Users, UserMinus, Search } from "lucide-react";

export default function AssignmentsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [assignments, setAssignments] = useState<HostelRoomAssignment[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [filterBuilding, setFilterBuilding] = useState("");

  // Form
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  // const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);
  // const [searchResults, setSearchResults] = useState<any[]>([]);
  // const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId, activeOnly, filterBuilding]);

  async function loadData() {
    try {
      setLoading(true);
      const [assignData, roomsData, buildingsData] = await Promise.all([
        getAssignments(schoolId, {
          active_only: activeOnly,
          building_id: filterBuilding || undefined,
        }),
        getRooms(schoolId),
        getBuildings(schoolId),
      ]);
      setAssignments(assignData);
      setRooms(roomsData);
      setBuildings(buildingsData);
    } catch (err) {
      console.error("Failed to load assignments:", err);
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

  function resetForm() {
    setSelectedRoomId("");
    setStudentSearch("");
    // setSearchQuery("");
    // setSearchResults([]);
    // setSelectedStudent(null);
    setSelectedStudentId("");
    setSelectedStudentName("");
    setNotes("");
  }

  // useEffect(() => {
  //   // if (!searchQuery || searchQuery.length < 2 || !schoolId) {
  //   if (!studentSearch || studentSearch.length < 2 || !schoolId) {
  //     setSearchResults([]);
  //     return;
  //   }
  //   const timer = setTimeout(async () => {
  //     try {
  //       // const results = await searchStudents(schoolId, searchQuery);
  //       const results = await searchStudents(schoolId, studentSearch);

  //       setSearchResults(Array.isArray(results) ? results : []);
  //     } catch {
  //       setSearchResults([]);
  //     }
  //   }, 300);
  //   return () => clearTimeout(timer);
  //   // }, [searchQuery, schoolId]);
  // }, [studentSearch, schoolId]);

  async function handleAssign() {
    // if (!selectedRoomId || !selectedStudent) return;
    if (!selectedRoomId || !selectedStudentId) return;
    try {
      setSubmitting(true);
      await assignStudent({
        room_id: selectedRoomId,
        // student_id: selectedStudent.id,
        student_id: selectedStudentId,
        school_id: schoolId,
        notes: notes || undefined,
      });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRelease(id: string) {
    if (!confirm("Release this student from their room?")) return;
    try {
      await releaseStudent(id);
      loadData();
    } catch (err) {
      console.error("Failed to release student:", err);
    }
  }

  // Get available rooms (not full)
  const availableRooms = rooms.filter(
    (r) => r.is_active && (r.occupancy || 0) < r.capacity,
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Room Assignments
          </h1>
          <p className="text-muted-foreground">
            Assign students to hostel rooms
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
              Assign Student
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>Assign Student to Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Room selector */}
              <div className="space-y-2">
                <Label>Room *</Label>
                <Select
                  value={selectedRoomId}
                  onValueChange={setSelectedRoomId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.building_name} — Room {r.room_number} (
                        {r.occupancy || 0}/{r.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student search */}
              <div className="space-y-2">
                <Label>Student *</Label>
                {/* {selectedStudent ? (
                  <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedStudent(null);
                        setSearchQuery("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) 
                : (
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search students..."
                      className="pl-9"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {searchResults.map((s: any) => (
                          <button
                            key={s.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                            onClick={() => {
                              setSelectedStudent(s);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                          >
                            {s.first_name} {s.last_name}{" "}
                            <span className="text-muted-foreground">
                              {s.admission_number
                                ? `#${s.admission_number}`
                                : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )} */}
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
                            className="w-full text-left px-3 py-2 text-sm text-black-200 hover:bg-accent transition-colors border-b last:border-0"
                            onClick={() => selectStudent(s)}
                          >
                            <div className="font-medium text-black-200">
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

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <Button
                onClick={handleAssign}
                // disabled={submitting || !selectedRoomId || !selectedStudent}
                disabled={submitting || !selectedRoomId || !selectedStudentId}
                className="w-full"
              >
                {submitting ? "Assigning..." : "Assign Student"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-2 items-center">
          <Label className="text-sm">Building:</Label>
          <Select
            value={filterBuilding || "ALL"}
            onValueChange={(v) => setFilterBuilding(v === "ALL" ? "" : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly(true)}
          >
            Active
          </Button>
          <Button
            variant={!activeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveOnly(false)}
          >
            All
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No assignments</h3>
              <p className="text-muted-foreground">
                Assign students to hostel rooms
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Student</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Building
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Room</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Assigned
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">
                        {a.student_name || a.student_id}
                      </td>
                      <td className="py-3 px-4">{a.building_name || "—"}</td>
                      <td className="py-3 px-4">{a.room_number || "—"}</td>
                      <td className="py-3 px-4">
                        {new Date(a.assigned_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {a.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Released{" "}
                            {a.released_date
                              ? new Date(a.released_date).toLocaleDateString()
                              : ""}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {a.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRelease(a.id)}
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Release
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
