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
import { Search, Eye, Edit, Download, MoreHorizontal, ChevronLeft, ChevronRight, Loader2, Users, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal";
import { EditStudentForm } from "@/components/admin";
import { type Student } from "@/lib/api/students";
import { useStudents } from "@/hooks/useStudents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGradeLevels } from "@/hooks/useAcademics";
import { getSchoolSettings, type StudentListAppendConfig } from "@/lib/api/school-settings";
import { useTranslations, useLocale } from "next-intl";
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

/**
 * Resolves a field path like "system.username" or "profile.email"
 * against a student record. Returns the value as a string, or null.
 */
function resolveStudentField(student: Student, fieldPath: string): string | null {
  if (!fieldPath) return null
  const [category, key] = fieldPath.split('.')
  if (category === 'profile') {
    const v = (student.profile as Record<string, unknown>)?.[key]
    return v != null ? String(v) : null
  }
  const v = student.custom_fields?.[category]?.[key]
  return v != null ? String(v) : null
}

/**
 * Builds the grade display string using the append config.
 * e.g. "Grade 9" or "Grade 9 / john.doe"
 */
function buildGradeDisplay(student: Student, grade: string, cfg: StudentListAppendConfig | null | undefined): string {
  if (!cfg?.enabled || !cfg.field) return grade
  const sep = cfg.separator ?? ' / '
  const v1 = resolveStudentField(student, cfg.field)
  const parts = [grade]
  if (v1) parts.push(v1)
  if (cfg.field2) {
    const v2 = resolveStudentField(student, cfg.field2)
    if (v2) parts.push(v2)
  }
  return parts.join(sep)
}

export default function StudentInfoPage() {
  const t = useTranslations("school.students.student_info");
  const tCommon = useTranslations("common");
  const locale = useLocale();
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
  const [appendConfig, setAppendConfig] = useState<StudentListAppendConfig | null>(null);

  // Load the "Append Custom Field to Grade Level" campus setting once on mount
  useEffect(() => {
    getSchoolSettings().then(res => {
      if (res.success && res.data?.student_list_append_config) {
        setAppendConfig(res.data.student_list_append_config)
      }
    }).catch(() => {})
  }, []);

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  // Use SWR hook for data fetching with caching
  const { students, total, totalPages, loading, error, refresh, updateStudent } = useStudents({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
    grade_level: gradeFilter,
  });

  const { gradeLevels } = useGradeLevels();

  // Show error toast if there's an error, but only for persistent errors
  // Skip transient errors during component mount/remount
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    // Wait a moment before showing errors to avoid transient errors on remount
    const timer = setTimeout(() => setHasInitialized(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error && hasInitialized) {
      // Don't show toast for network errors or cancelled requests
      if (error.message === 'Network error' || 
          error.message === 'Request cancelled' ||
          error.message === 'Failed to fetch') {
        return;
      }
      toast.error(error.message || tCommon("error"));
    }
  }, [error, hasInitialized, tCommon]);

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

  const handleToggleStudentStatus = async (student: Student) => {
    try {
      const newStatus = !student.profile?.is_active;
      await updateStudent(student.id, { is_active: newStatus });
      toast.success(newStatus ? t("msg_activated") : t("msg_deactivated"));
      refresh(); // Refresh the students list
    } catch (error) {
      console.error('Error toggling student status:', error);
      toast.error(t("msg_update_failed"));
    }
  };

  // Reset to page 1 when filters change
  const handleFilterChange = (filterSetter: (value: string) => void) => (value: string) => {
    filterSetter(value);
    setCurrentPage(1);
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{tCommon("active")}</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{tCommon("inactive")}</Badge>
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
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("search_placeholder")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10 rtl:pr-10 rtl:pl-3"
                  />
                </div>

                <Select value={gradeFilter} onValueChange={handleFilterChange(setGradeFilter)}>
                  <SelectTrigger className="w-full md:w-45">
                    <SelectValue placeholder={t("filter_grade")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_grades")}</SelectItem>
                    {gradeLevels.map((grade) => (
                      <SelectItem key={grade.id} value={grade.name}>
                        {grade.name}
                      </SelectItem>
                    ))}
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
                  {tCommon("clearAll")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            {loading ? (
              <span>{tCommon("loading")}</span>
            ) : (
              <span>
                {t("showing_range", {
                  start: students.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0,
                  end: Math.min(currentPage * itemsPerPage, total),
                  total: total
                })}
              </span>
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
                      <TableHead className="text-left rtl:text-right">{t("th_student_id")}</TableHead>
                      <TableHead className="text-left rtl:text-right">{tCommon("name")}</TableHead>
                      <TableHead className="text-left rtl:text-right">{tCommon("grade")}</TableHead>
                      <TableHead className="text-left rtl:text-right">{tCommon("status")}</TableHead>
                      <TableHead className="text-left rtl:text-right">{t("th_contact")}</TableHead>
                      <TableHead className="text-right rtl:text-left">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {t("no_students_found")}
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
                                    {initials || tCommon("noData")}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">
                                    {fullName || tCommon("noData")}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{student.profile?.email || tCommon("noData")}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{buildGradeDisplay(student, student.grade_level || tCommon("noData"), appendConfig)}</TableCell>
                            <TableCell>{getStatusBadge(student.profile?.is_active ? 'active' : 'inactive')}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{student.profile?.phone || tCommon("noData")}</div>
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
                                  <DropdownMenuLabel>{tCommon("actions")}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleViewDetails(student)}>
                                    <Eye className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                    {tCommon("view")} {tCommon("details")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const parentId = student.custom_fields?.family?.linked_parent_id;
                                      if (parentId) {
                                        setSelectedStudent(student);
                                        setSelectedParentId(parentId);
                                        setShowParentDialog(true);
                                      } else {
                                        toast.error(t("msg_no_parent"));
                                      }
                                    }}
                                  >
                                    <Users className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                    {t("view_parent_details")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setCredentialsData({
                                      id: student.id,
                                      name: `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`
                                    });
                                    setShowCredentialsModal(true);
                                  }}>
                                    <Lock className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                    {t("edit_credentials")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                                    <Edit className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                    {t("edit_student")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleStudentStatus(student)}>
                                    {student.profile?.is_active ? (
                                      <>
                                        <UserX className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                        {t("deactivate_student")}
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                                        {t("activate_student")}
                                      </>
                                    )}
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

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("showing_range", {
                start: students.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0,
                end: Math.min(currentPage * itemsPerPage, total),
                total: total
              })}
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
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                      {tCommon("previous")}
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
                      {tCommon("next")}
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
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
                <DialogTitle>{t("parent_details")}</DialogTitle>
              </DialogHeader>
              {selectedStudent && selectedParentId && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("linked_student")}</p>
                      <p className="font-medium">{selectedStudent.profile?.first_name} {selectedStudent.profile?.last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t("relationship")}</p>
                      <p className="font-medium capitalize">{selectedStudent.custom_fields?.family?.parent_relation_type || tCommon("noData")}</p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("parent_management_note")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`/admin/parents/parent-info?id=${selectedParentId}`, '_blank')}
                    >
                      {t("open_parent_profile")}
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
