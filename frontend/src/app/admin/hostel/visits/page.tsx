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
  getVisits,
  createVisit,
  checkOutVisit,
  searchStudents,
} from "@/lib/api/hostel";
import { HostelVisit } from "@/types";
import { Plus, Eye, LogOut, Search, Users } from "lucide-react";

export default function VisitsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [visits, setVisits] = useState<HostelVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);

  // Form
  // const [searchQuery, setSearchQuery] = useState("");
  // const [searchResults, setSearchResults] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);
  // const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorRelation, setVisitorRelation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Date filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId, activeOnly, dateFrom, dateTo]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getVisits(schoolId, {
        active_only: activeOnly,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setVisits(data);
    } catch (err) {
      console.error("Failed to load visits:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    // setSearchQuery("");
    // setSearchResults([]);
    // setSelectedStudent(null);
    setStudentSearch("");
    setSelectedStudentId("");
    setSelectedStudentName("");
    setVisitorName("");
    setVisitorPhone("");
    setVisitorRelation("");
    setPurpose("");
    setVisitNotes("");
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

  // useEffect(() => {
  //   if (!searchQuery || searchQuery.length < 2 || !schoolId) {
  //     setSearchResults([]);
  //     return;
  //   }
  //   const timer = setTimeout(async () => {
  //     try {
  //       const results = await searchStudents(schoolId, searchQuery);
  //       setSearchResults(Array.isArray(results) ? results : []);
  //     } catch {
  //       setSearchResults([]);
  //     }
  //   }, 300);
  //   return () => clearTimeout(timer);
  // }, [searchQuery, schoolId]);

  async function handleCreate() {
    // if (!selectedStudent || !visitorName) return;
    if (!selectedStudentId || !visitorName) return;
    try {
      setSubmitting(true);
      await createVisit({
        // student_id: selectedStudent.id,
        student_id: selectedStudentId,
        school_id: schoolId,
        visitor_name: visitorName,
        visitor_phone: visitorPhone || undefined,
        visitor_relation: visitorRelation || undefined,
        purpose: purpose || undefined,
        notes: visitNotes || undefined,
      });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create visit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut(visitId: string) {
    if (!confirm("Check out this visitor?")) return;
    try {
      await checkOutVisit(visitId);
      loadData();
    } catch (err) {
      console.error("Failed to checkout:", err);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hostel Visits</h1>
          <p className="text-muted-foreground">
            Track visitors to hostel students
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
              Record Visit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>Record New Visit</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
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
                ) : (
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
                            {s.first_name} {s.last_name}
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
                <Label>Visitor Name *</Label>
                <Input
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Relation</Label>
                  <Input
                    value={visitorRelation}
                    onChange={(e) => setVisitorRelation(e.target.value)}
                    placeholder="e.g. Parent"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Reason for visit"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Optional..."
                />
              </div>
              <Button
                onClick={handleCreate}
                // disabled={submitting || !selectedStudent || !visitorName}
                disabled={submitting || !selectedStudentId || !visitorName}
                className="w-full"
              >
                {submitting ? "Saving..." : "Record Visit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end flex-wrap">
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
        <div className="flex gap-2 items-center">
          <Label className="text-sm">From:</Label>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center">
          <Label className="text-sm">To:</Label>
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12">
              <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No visits found</h3>
              <p className="text-muted-foreground">
                Record a new visitor check-in
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Visitor</th>
                    <th className="text-left py-3 px-4 font-medium">Student</th>
                    <th className="text-left py-3 px-4 font-medium">Room</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Relation
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Check In
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Check Out
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">
                        {v.visitor_name}
                      </td>
                      <td className="py-3 px-4">
                        {v.student_name || v.student_id}
                      </td>
                      <td className="py-3 px-4">{v.room_number || "—"}</td>
                      <td className="py-3 px-4">{v.visitor_relation || "—"}</td>
                      <td className="py-3 px-4">
                        {new Date(v.check_in).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {v.check_out
                          ? new Date(v.check_out).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {v.check_out ? (
                          <Badge variant="secondary">Checked Out</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!v.check_out && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCheckOut(v.id)}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Check Out
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
