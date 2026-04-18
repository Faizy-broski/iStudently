"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, ChevronLeft, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { type Student } from "@/lib/api/students";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { MoreHorizontal } from "lucide-react";

export default function TeacherStudentInfoPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  // ✅ SECURE: useTeacherStudents only returns students from the teacher's assigned sections.
  // It does NOT use useStudents (the admin hook) — those are completely separate.
  const { students, total, totalPages, loading, error, hasNoSections, sectionCount } = useTeacherStudents({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    grade_level: gradeFilter,
  });

  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHasInitialized(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error && hasInitialized) {
      if (error === 'Network error' || error === 'Request cancelled' || error === 'Failed to fetch') return;
      toast.error(error || 'An error occurred');
    }
  }, [error, hasInitialized]);

  const handleViewDetails = (student: Student) => {
    router.push(`/teacher/students/${student.id}`);
  };

  // Empty state when teacher has no section assignments yet
  if (hasNoSections && !loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Sections Assigned</h2>
        <p className="text-muted-foreground max-w-sm">
          You have not been assigned to any sections yet. Contact your administrator to get assigned to a section.
        </p>
      </div>
    );
  }

  const handleFilterChange = (filterSetter: (value: string) => void) => (value: string) => {
    filterSetter(value);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white dark:bg-linear-to-r dark:from-[#57A3CC] dark:to-white">
          My Students
        </h1>
        <p className="text-muted-foreground mt-2">
          Students from your assigned sections
          {sectionCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {sectionCount} section{sectionCount !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>


      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, student ID, or email..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            <Select value={gradeFilter} onValueChange={handleFilterChange(setGradeFilter)}>
              <SelectTrigger className="w-full md:w-45">
                <SelectValue placeholder="Filter by Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                <SelectItem value="Grade 9">Grade 9</SelectItem>
                <SelectItem value="Grade 10">Grade 10</SelectItem>
                <SelectItem value="Grade 11">Grade 11</SelectItem>
                <SelectItem value="Grade 12">Grade 12</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => { setSearchQuery(""); setGradeFilter("all"); setCurrentPage(1); }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>Showing {students.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, total)} of {total} students</span>
        )}
      </div>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No students found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => {
                    const fullName = `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim();
                    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();
                    return (
                      <TableRow
                        key={student.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleViewDetails(student)}
                      >
                        <TableCell className="font-medium">{student.student_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {(student.profile?.profile_photo_url || student.custom_fields?.personal?.student_photo) ? (
                              <img
                                src={student.profile?.profile_photo_url || student.custom_fields?.personal?.student_photo}
                                alt={fullName}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-linear-to-r from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold text-sm">
                                {initials || 'N/A'}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{fullName || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{student.profile?.email || 'No email'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{student.grade_level || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge(student.profile?.is_active ? 'active' : 'inactive')}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{student.profile?.phone || 'No phone'}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleViewDetails(student)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {students.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, total)} of {total} students
        </p>
        {totalPages > 0 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <PaginationItem key={page}><PaginationEllipsis /></PaginationItem>;
                }
                return null;
              })}
              <PaginationItem>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
