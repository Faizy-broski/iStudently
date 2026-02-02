"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Edit, Download, MoreHorizontal, ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal";
import { EditStudentForm } from "@/components/admin";
import { type Student, updateStudent } from "@/lib/api/students";
import { useStudents } from "@/hooks/useStudents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function StudentInfoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const campusContext = useCampus();
  const schoolId = user?.school_id || '';
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{ id: string, name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showParentDialog, setShowParentDialog] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  // Use SWR hook for data fetching with caching
  const { students, total, totalPages, loading, error, refresh } = useStudents({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    grade_level: gradeFilter,
  });

  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleViewDetails = (student: Student) => {
    // Navigate to the full details page using student number for readable URLs
    router.push(`/admin/students/${encodeURIComponent(student.student_number)}`);
  };

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowEditForm(true);
  };

  const handleEditSuccess = () => {
    setShowEditForm(false);
    setSelectedStudent(null);
    // Refresh the students list
    // Note: SWR will automatically revalidate
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setSelectedStudent(null);
  };

  // Reset to page 1 when filters change
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
      {showEditForm && selectedStudent ? (
        // Edit Student Form
        <EditStudentForm
          student={selectedStudent}
          onSuccess={handleEditSuccess}
          onCancel={handleEditCancel}
        />
      ) : (
        // Student List View
        <>
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white dark:bg-linear-to-r dark:from-[#57A3CC] dark:to-white">
              Student Information
            </h1>
            <p className="text-muted-foreground mt-2">Search and view detailed student information</p>
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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

            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setGradeFilter("all");
                setCurrentPage(1);
              }}
            >
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
                      <TableRow key={student.id}>
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
                              <div className="font-medium">
                                {fullName || 'N/A'}
                              </div>
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
                        <TableCell className="text-right">
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
                              <DropdownMenuItem
                                onClick={() => {
                                  const parentId = student.custom_fields?.family?.linked_parent_id;
                                  if (parentId) {
                                    setSelectedStudent(student);
                                    setSelectedParentId(parentId);
                                    setShowParentDialog(true);
                                  } else {
                                    toast.error('No parent linked to this student');
                                  }
                                }}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                View Parent Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setCredentialsData({
                                  id: student.id,
                                  name: `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`
                                });
                                setShowCredentialsModal(true);
                              }}>
                                <Lock className="mr-2 h-4 w-4" />
                                Edit Credentials
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Student
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download Report
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}

              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* Parent Dialog - Keeping for "View Parent Details" action */}
      <Dialog open={showParentDialog} onOpenChange={setShowParentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parent Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && selectedParentId && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Linked Student</p>
                  <p className="font-medium">{selectedStudent.profile?.first_name} {selectedStudent.profile?.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relationship</p>
                  <p className="font-medium capitalize">{selectedStudent.custom_fields?.family?.parent_relation_type || 'N/A'}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  To view full parent details, go to the Parent Management section.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/admin/parents/parent-info?id=${selectedParentId}`, '_blank')}
                >
                  Open Full Parent Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}
      
      {/* Credentials Modal */}
      {credentialsData && (
        <EditCredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => setShowCredentialsModal(false)}
          entityId={credentialsData.id}
          entityName={credentialsData.name}
          entityType="student"
          schoolId={schoolId}
          campusId={campusContext?.selectedCampus?.id} 
          onSuccess={() => { }}
        />
      )}
    </div>
  );
}
