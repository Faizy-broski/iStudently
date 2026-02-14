"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPackages,
  createPackage,
  pickupPackage,
  searchStudents,
} from "@/lib/api/entry-exit";
import { PackageDelivery } from "@/types";
import {
  Plus,
  Package,
  PackageCheck,
  Search,
  Users,
  Clock,
  Gift,
} from "lucide-react";

export default function PackagesPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [packages, setPackages] = useState<PackageDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  // Form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [sender, setSender] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Student search
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (schoolId) loadPackages();
  }, [schoolId, filterStatus]);

  async function loadPackages() {
    try {
      setLoading(true);
      const data = await getPackages({
        school_id: schoolId,
        status: filterStatus !== "all" ? filterStatus : undefined,
      });
      setPackages(data);
    } catch (err) {
      console.error("Failed to load packages:", err);
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

  async function handleCreate() {
    if (!selectedStudentId) return;
    try {
      setSubmitting(true);
      await createPackage({
        school_id: schoolId,
        student_id: selectedStudentId,
        description: description || undefined,
        sender: sender || undefined,
      });
      setDialogOpen(false);
      resetForm();
      loadPackages();
    } catch (err) {
      console.error("Failed to create package:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePickup(id: string) {
    try {
      await pickupPackage(id);
      loadPackages();
    } catch (err) {
      console.error("Failed to pickup:", err);
    }
  }

  function resetForm() {
    setSelectedStudentId("");
    setSelectedStudentName("");
    setDescription("");
    setSender("");
    setStudentSearch("");
  }

  const pendingCount = packages.filter((p) => p.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Package Tracking
          </h1>
          <p className="text-muted-foreground">
            Track and manage package deliveries for students
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {pendingCount} pending
              </span>
            )}
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
              Add Package
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>Register Package</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
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
                <Label>Description (Optional)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Small cardboard box"
                />
              </div>

              <div className="space-y-2">
                <Label>Sender (Optional)</Label>
                <Input
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="e.g. Amazon, Parent name..."
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={submitting || !selectedStudentId}
                className="w-full"
              >
                {submitting ? "Registering..." : "Register Package"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Packages</SelectItem>
            <SelectItem value="pending">Pending Pickup</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Packages Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading packages...
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No packages found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">
                      {pkg.student_name ||
                        (pkg.students?.profiles
                          ? `${pkg.students.profiles.first_name} ${pkg.students.profiles.last_name}`
                          : pkg.student_id.slice(0, 8))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pkg.description || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pkg.sender || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          pkg.status === "pending"
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        }
                      >
                        {pkg.status === "pending" ? (
                          <>
                            <Package className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        ) : (
                          <>
                            <PackageCheck className="h-3 w-3 mr-1" />
                            Collected
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(pkg.received_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {pkg.collected_at
                        ? new Date(pkg.collected_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {pkg.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handlePickup(pkg.id)}
                        >
                          <PackageCheck className="h-3 w-3" />
                          Mark Collected
                        </Button>
                      )}
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
