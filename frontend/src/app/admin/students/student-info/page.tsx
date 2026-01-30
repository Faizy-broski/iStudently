"use client";

import { useState, useEffect } from "react";
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
  const { user } = useAuth();
  const campusContext = useCampus();
  const schoolId = user?.school_id || '';
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{ id: string, name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
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
    setSelectedStudent(student);
    setShowDetailsDialog(true);
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

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-center gap-4 pb-4 border-b">
                {(selectedStudent.profile?.profile_photo_url || selectedStudent.custom_fields?.personal?.student_photo) ? (
                  <img
                    src={selectedStudent.profile?.profile_photo_url || selectedStudent.custom_fields?.personal?.student_photo || ''}
                    alt="Student"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-linear-to-r from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold text-xl">
                    {`${selectedStudent.profile?.first_name?.[0] || ''}${selectedStudent.profile?.last_name?.[0] || ''}`.toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedStudent.profile?.first_name} {selectedStudent.profile?.father_name && `${selectedStudent.profile.father_name} `}{selectedStudent.profile?.grandfather_name && `${selectedStudent.profile.grandfather_name} `}{selectedStudent.profile?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.student_number} • {selectedStudent.grade_level || 'N/A'}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge className={selectedStudent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {selectedStudent.profile?.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {selectedStudent.custom_fields?.personal?.gender && (
                      <Badge variant="outline" className="capitalize">
                        {selectedStudent.custom_fields.personal.gender}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">First Name</p>
                    <p className="font-medium">{selectedStudent.profile?.first_name || 'N/A'}</p>
                  </div>
                  {selectedStudent.profile?.father_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Father&apos;s Name</p>
                      <p className="font-medium">{selectedStudent.profile.father_name}</p>
                    </div>
                  )}
                  {selectedStudent.profile?.grandfather_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Grandfather&apos;s Name</p>
                      <p className="font-medium">{selectedStudent.profile.grandfather_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Surname</p>
                    <p className="font-medium">{selectedStudent.profile?.last_name || 'N/A'}</p>
                  </div>
                  {selectedStudent.custom_fields?.personal?.date_of_birth && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{new Date(selectedStudent.custom_fields.personal.date_of_birth).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedStudent.profile?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedStudent.profile?.phone || 'N/A'}</p>
                  </div>
                  {selectedStudent.custom_fields?.personal?.address && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedStudent.custom_fields.personal.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Academic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Student Number</p>
                    <p className="font-medium">{selectedStudent.student_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grade Level</p>
                    <p className="font-medium">{selectedStudent.grade_level || 'N/A'}</p>
                  </div>
                  {selectedStudent.custom_fields?.system?.username && (
                    <div>
                      <p className="text-sm text-muted-foreground">Username</p>
                      <p className="font-medium">{selectedStudent.custom_fields.system.username}</p>
                    </div>
                  )}
                  {selectedStudent.custom_fields?.academic?.admission_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Admission Date</p>
                      <p className="font-medium">{new Date(selectedStudent.custom_fields.academic.admission_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedStudent.custom_fields?.academic?.previous_school?.schoolName && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Previous School</p>
                      <p className="font-medium">{selectedStudent.custom_fields.academic.previous_school.schoolName}</p>
                      {selectedStudent.custom_fields.academic.previous_school.lastGradeCompleted && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last Grade: {selectedStudent.custom_fields.academic.previous_school.lastGradeCompleted}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Medical Information */}
              {selectedStudent.medical_info && Object.keys(selectedStudent.medical_info).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Medical Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedStudent.medical_info.blood_group && (
                      <div>
                        <p className="text-sm text-muted-foreground">Blood Group</p>
                        <p className="font-medium">{selectedStudent.medical_info.blood_group}</p>
                      </div>
                    )}
                    {selectedStudent.medical_info.allergies && selectedStudent.medical_info.allergies.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Allergies</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedStudent.medical_info.allergies.map((allergy, idx) => (
                            <Badge key={idx} variant="outline">{allergy}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedStudent.medical_info.emergency_notes && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Medical Notes</p>
                        <p className="font-medium whitespace-pre-wrap">{selectedStudent.medical_info.emergency_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emergency Contacts */}
              {selectedStudent.custom_fields?.family?.emergency_contacts && selectedStudent.custom_fields.family.emergency_contacts.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Emergency Contacts</h4>
                  <div className="space-y-3">
                    {selectedStudent.custom_fields.family.emergency_contacts.map((contact: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{contact.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium capitalize">{contact.relationship}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium">{contact.phone}</p>
                          </div>
                          {contact.address && (
                            <div>
                              <p className="text-sm text-muted-foreground">Address</p>
                              <p className="font-medium text-sm">{contact.address}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              try {
                const updateData = {
                  first_name: formData.get('firstName') as string,
                  last_name: formData.get('lastName') as string,
                  email: formData.get('email') as string,
                  phone: formData.get('phone') as string,
                  student_number: formData.get('studentNumber') as string,
                  grade_level: formData.get('gradeLevel') as string,
                };

                const result = await updateStudent(selectedStudent.id, updateData, campusContext?.selectedCampus?.id);
                
                if (result.success) {
                  toast.success('Student updated successfully!');
                  setShowEditDialog(false);
                  // Refresh the students list
                  refresh();
                } else {
                  toast.error(result.error || 'Failed to update student');
                }
              } catch (error) {
                toast.error('Failed to update student');
                console.error(error);
              }
            }}>
              {/* Personal Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Personal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-firstName">First Name</Label>
                    <Input
                      id="edit-firstName"
                      name="firstName"
                      defaultValue={selectedStudent.profile?.first_name || ''}
                      placeholder="First Name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-lastName">Last Name</Label>
                    <Input
                      id="edit-lastName"
                      name="lastName"
                      defaultValue={selectedStudent.profile?.last_name || ''}
                      placeholder="Last Name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      name="email"
                      type="email"
                      defaultValue={selectedStudent.profile?.email || ''}
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      defaultValue={selectedStudent.profile?.phone || ''}
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-gender">Gender</Label>
                    <Input
                      id="edit-gender"
                      name="gender"
                      defaultValue={selectedStudent.custom_fields?.personal?.gender || ''}
                      placeholder="Gender"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-dob">Date of Birth</Label>
                    <Input
                      id="edit-dob"
                      name="dateOfBirth"
                      type="date"
                      defaultValue={selectedStudent.custom_fields?.personal?.date_of_birth ? new Date(selectedStudent.custom_fields.personal.date_of_birth).toISOString().split('T')[0] : ''}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Textarea
                      id="edit-address"
                      name="address"
                      defaultValue={selectedStudent.custom_fields?.personal?.address || ''}
                      placeholder="Address"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Academic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-studentNumber">Student Number</Label>
                    <Input
                      id="edit-studentNumber"
                      name="studentNumber"
                      defaultValue={selectedStudent.student_number}
                      placeholder="Student Number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-gradeLevel">Grade Level</Label>
                    <Input
                      id="edit-gradeLevel"
                      name="gradeLevel"
                      defaultValue={selectedStudent.grade_level || ''}
                      placeholder="Grade Level"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-username">Username</Label>
                    <Input
                      id="edit-username"
                      name="username"
                      defaultValue={selectedStudent.custom_fields?.system?.username || ''}
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-admissionDate">Admission Date</Label>
                    <Input
                      id="edit-admissionDate"
                      name="admissionDate"
                      type="date"
                      defaultValue={selectedStudent.custom_fields?.academic?.admission_date ? new Date(selectedStudent.custom_fields.academic.admission_date).toISOString().split('T')[0] : ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-previousSchool">Previous School</Label>
                    <Input
                      id="edit-previousSchool"
                      name="previousSchool"
                      defaultValue={selectedStudent.custom_fields?.academic?.previous_school?.schoolName || ''}
                      placeholder="Previous School Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-lastGrade">Last Grade Completed</Label>
                    <Input
                      id="edit-lastGrade"
                      name="lastGrade"
                      defaultValue={selectedStudent.custom_fields?.academic?.previous_school?.lastGradeCompleted || ''}
                      placeholder="Last Grade"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Medical Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-bloodGroup">Blood Group</Label>
                    <Input
                      id="edit-bloodGroup"
                      name="bloodGroup"
                      defaultValue={selectedStudent.medical_info?.blood_group || ''}
                      placeholder="Blood Group"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-allergies">Allergies (comma-separated)</Label>
                    <Input
                      id="edit-allergies"
                      name="allergies"
                      defaultValue={selectedStudent.medical_info?.allergies?.join(', ') || ''}
                      placeholder="e.g., Peanuts, Dust"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit-medicalNotes">Medical Notes</Label>
                    <Textarea
                      id="edit-medicalNotes"
                      name="medicalNotes"
                      defaultValue={selectedStudent.medical_info?.emergency_notes || ''}
                      placeholder="Medical notes"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              {selectedStudent.custom_fields?.family?.emergency_contacts && selectedStudent.custom_fields.family.emergency_contacts.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm">Emergency Contact</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-emergencyName">Contact Name</Label>
                      <Input
                        id="edit-emergencyName"
                        name="emergencyName"
                        defaultValue={selectedStudent.custom_fields.family.emergency_contacts[0]?.name || ''}
                        placeholder="Contact Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-emergencyRelation">Relationship</Label>
                      <Input
                        id="edit-emergencyRelation"
                        name="emergencyRelation"
                        defaultValue={selectedStudent.custom_fields.family.emergency_contacts[0]?.relationship || ''}
                        placeholder="Relationship"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-emergencyPhone">Contact Phone</Label>
                      <Input
                        id="edit-emergencyPhone"
                        name="emergencyPhone"
                        defaultValue={selectedStudent.custom_fields.family.emergency_contacts[0]?.phone || ''}
                        placeholder="Phone Number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-emergencyAddress">Contact Address</Label>
                      <Input
                        id="edit-emergencyAddress"
                        name="emergencyAddress"
                        defaultValue={selectedStudent.custom_fields.family.emergency_contacts[0]?.address || ''}
                        placeholder="Address"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Parent Details Dialog */}
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
