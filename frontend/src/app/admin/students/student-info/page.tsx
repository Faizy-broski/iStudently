"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/useTableSort";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Download, MoreHorizontal, ChevronLeft, ChevronRight, Loader2, Users, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal";
import { EditStudentForm } from "@/components/admin";
import { type Student, getStudentById, bulkDeleteStudents, bulkUpdateStudentStatus } from "@/lib/api/students";
import { useStudents } from "@/hooks/useStudents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { UniversalFilter, type FilterState } from "@/components/filters/UniversalFilter";
import { getSchoolSettings, type StudentListAppendConfig } from "@/lib/api/school-settings";
import { useTranslations, useLocale } from "next-intl";
import { useGradeLevels } from "@/hooks/useAcademics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type StudentSortKey = "student_number" | "name" | "grade" | "status" | "contact";

export default function StudentInfoPage() {
  const t = useTranslations("school.students.student_info");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const campusContext = useCampus();
  const schoolId = user?.school_id || '';
  const isSuperAdmin = profile?.role === 'super_admin';
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{ id: string, name: string, profileId?: string } | null>(null);
  const [studentFilters, setStudentFilters] = useState<FilterState>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showParentDialog, setShowParentDialog] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const itemsPerPage = 10;
  const [appendConfig, setAppendConfig] = useState<StudentListAppendConfig | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteMode, setConfirmDeleteMode] = useState<"selected" | "class" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Status Modal States (Deactivate / Activate by List, Grade, or School)
  const { gradeLevels = [], isLoading: loadingGradeLevels } = useGradeLevels();
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusAction, setBulkStatusAction] = useState<'deactivate' | 'activate'>('deactivate');
  const [bulkStatusMode, setBulkStatusMode] = useState<'selected' | 'grade' | 'school'>('selected');
  const [bulkTargetGradeId, setBulkTargetGradeId] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (showBulkStatusModal && !bulkTargetGradeId) {
      if (studentFilters.gradeId) {
        setBulkTargetGradeId(studentFilters.gradeId);
      } else if (gradeLevels && gradeLevels.length > 0) {
        setBulkTargetGradeId(gradeLevels[0].id);
      }
    }
  }, [showBulkStatusModal, studentFilters.gradeId, gradeLevels, bulkTargetGradeId]);

  const handleBulkStatusChange = async () => {
    const is_active = bulkStatusAction === 'activate';
    const gradeId = bulkStatusMode === 'grade' ? (bulkTargetGradeId || studentFilters.gradeId) : undefined;

    if (bulkStatusMode === 'grade' && !gradeId) {
      toast.error("Please select a target grade level");
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const result = await bulkUpdateStudentStatus({
        mode: bulkStatusMode,
        is_active,
        studentIds: bulkStatusMode === 'selected' ? Array.from(selectedIds) : undefined,
        gradeLevelId: gradeId,
        sectionId: bulkStatusMode === 'grade' ? studentFilters.sectionId : undefined,
        campusId: campusContext?.selectedCampus?.id || undefined,
      });

      if (!result.success || result.data === undefined) {
        toast.error(result.error || t("msg_update_failed"));
        return;
      }

      toast.success(
        is_active
          ? `${result.data.updated} student(s) activated successfully`
          : `${result.data.updated} student(s) deactivated successfully`
      );
      setShowBulkStatusModal(false);
      setSelectedIds(new Set());
      refresh();
    } catch {
      toast.error(t("msg_update_failed"));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Load the "Append Custom Field to Grade Level" campus setting once on mount
  useEffect(() => {
    getSchoolSettings().then(res => {
      if (res.success && res.data?.student_list_append_config) {
        setAppendConfig(res.data.student_list_append_config)
      }
    }).catch(() => {})
  }, []);

  // Debounce search is handled inside UniversalFilter; pass the filter value directly
  const { students, total, totalPages, loading, error, refresh, updateStudent } = useStudents({
    page: currentPage,
    limit: itemsPerPage,
    search: studentFilters.search || undefined,
    // Use multi-select grade names array when available, fall back to single
    grade_level: studentFilters.gradeNames?.length
      ? studentFilters.gradeNames
      : studentFilters.gradeName
        ? [studentFilters.gradeName]
        : undefined,
    section_id: studentFilters.sectionId || undefined,
    // Undefined = include both active and inactive; true = active only
    is_active: showInactive ? undefined : true,
  });

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

  // Auto-open edit form when navigated from detail page with ?edit=<uuid>
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    const fromList = students.find(s => s.id === editId);
    if (fromList) {
      setSelectedStudent(fromList);
      setShowEditForm(true);
      return;
    }
    // Student not in the current page — fetch directly by ID
    getStudentById(editId).then((res) => {
      if (res.data?.id) {
        setSelectedStudent(res.data);
        setShowEditForm(true);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    router.replace('/admin/students/student-info');
  };

  const handleEditCancel = () => {
    setShowEditForm(false);
    setSelectedStudent(null);
    router.replace('/admin/students/student-info');
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

  const handleStudentFilterChange = (filters: FilterState) => {
    setStudentFilters(filters);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredStudents.map(s => s.id)) : new Set());
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await bulkDeleteStudents(
        confirmDeleteMode === "class"
          ? { gradeLevelId: studentFilters.gradeId, sectionId: studentFilters.sectionId }
          : { studentIds: Array.from(selectedIds) }
      );

      if (!result.success || !result.data) {
        toast.error(result.error || t("msg_delete_failed"));
        return;
      }

      if (result.data.errors.length > 0) {
        toast.warning(t("msg_delete_partial", { count: result.data.deleted, errors: result.data.errors.length }));
      } else {
        toast.success(t("msg_delete_success", { count: result.data.deleted }));
      }
      setSelectedIds(new Set());
      refresh();
    } catch {
      toast.error(t("msg_delete_failed"));
    } finally {
      setIsDeleting(false);
      setConfirmDeleteMode(null);
    }
  };

  const getStatusBadge = (status: string) => {
    return status === "active" ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{tCommon("active")}</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">{tCommon("inactive")}</Badge>
    );
  };

  // Active/inactive filtering is applied server-side via the is_active param
  const getStudentSortValue = (student: Student, key: StudentSortKey): string | number => {
    switch (key) {
      case "student_number": return student.student_number || "";
      case "name": return `${student.profile?.first_name || ""} ${student.profile?.last_name || ""}`.trim();
      case "grade": return student.grade?.name || student.grade_level || "";
      case "status": return student.profile?.is_active ? "active" : "inactive";
      case "contact": return student.profile?.phone || "";
      default: return "";
    }
  };
  const { sorted: sortedStudents, sortKey, sortDir, toggleSort } = useTableSort<Student, StudentSortKey>(
    students, getStudentSortValue, "name", "asc"
  );
  const filteredStudents = sortedStudents;

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

          {/* Universal Filter Bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-3">
                <UniversalFilter
                  availableFilters={['search', 'grade', 'section']}
                  entityType="students"
                  currentFilters={studentFilters}
                  onFilterChange={handleStudentFilterChange}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => { setShowInactive(e.target.checked); setCurrentPage(1); }}
                    className="rounded border-gray-300"
                  />
                  {tCommon("showInactive")}
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Operations Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <span className="text-foreground font-semibold">
                  {selectedIds.size} student(s) selected
                </span>
              ) : (
                <span>Bulk Options</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                onClick={() => {
                  setBulkStatusAction("deactivate");
                  setBulkStatusMode(selectedIds.size > 0 ? "selected" : "grade");
                  setShowBulkStatusModal(true);
                }}
              >
                <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Bulk Deactivate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                onClick={() => {
                  setBulkStatusAction("activate");
                  setBulkStatusMode(selectedIds.size > 0 ? "selected" : "grade");
                  setShowBulkStatusModal(true);
                }}
              >
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Bulk Activate
              </Button>
              {isSuperAdmin && selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setConfirmDeleteMode("selected")}
                >
                  <Trash2 className="h-4 w-4" /> {t("btn_delete_selected")}
                </Button>
              )}
              {isSuperAdmin && studentFilters.gradeId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => setConfirmDeleteMode("class")}
                >
                  <Trash2 className="h-4 w-4" /> {t("btn_delete_by_class")}
                </Button>
              )}
            </div>
          </div>

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
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label={t("th_select")}
                          checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <SortableTableHead className="text-left rtl:text-right" label={t("th_student_id")} sortKey="student_number" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                      <SortableTableHead className="text-left rtl:text-right" label={tCommon("name")} sortKey="name" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                      <SortableTableHead className="text-left rtl:text-right" label={tCommon("grade")} sortKey="grade" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                      <SortableTableHead className="text-left rtl:text-right" label={tCommon("status")} sortKey="status" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                      <SortableTableHead className="text-left rtl:text-right" label={t("th_contact")} sortKey="contact" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                      <TableHead className="text-right rtl:text-left">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {t("no_students_found")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStudents.map((student) => {
                        const fullName = `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim();
                        const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                          <TableRow
                            key={student.id}
                            className="hover:bg-muted/50 cursor-pointer"
                            onClick={() => handleViewDetails(student)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={t("th_select")}
                                checked={selectedIds.has(student.id)}
                                onChange={(e) => toggleSelectOne(student.id, e.target.checked)}
                                className="rounded border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.student_number}</TableCell>
                            <TableCell className="max-w-sm">
                              <div className="flex items-center gap-3">
                                <ProfilePhoto
                                  src={student.profile?.profile_photo_url || student.custom_fields?.personal?.student_photo}
                                  name={fullName}
                                  size="xs"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">
                                    {fullName || tCommon("noData")}
                                  </div>
                                  <div className="text-sm text-muted-foreground truncate">{student.profile?.email || tCommon("noData")}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">{buildGradeDisplay(student, student.grade?.name || student.grade_level || tCommon("noData"), appendConfig)}</TableCell>
                            <TableCell>{getStatusBadge(student.profile?.is_active ? 'active' : 'inactive')}</TableCell>
                            <TableCell className="max-w-xs">
                              <div className="text-sm truncate">
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
                                      name: `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`,
                                      profileId: student.profile_id || undefined
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
                      onClick={() => window.open(`/admin/parents/${selectedParentId}`, '_blank')}
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
          profileId={credentialsData.profileId}
          onSuccess={() => { }}
        />
      )}

      {/* Bulk Delete Confirmation (super admin only) */}
      <AlertDialog open={confirmDeleteMode !== null} onOpenChange={(open) => !open && setConfirmDeleteMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm_delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteMode === "class"
                ? t("confirm_delete_by_class_desc")
                : t("confirm_delete_desc", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("btn_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("btn_confirm_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bulk Status Update Dialog (Deactivate / Activate by List, Grade, or School) */}
      <Dialog open={showBulkStatusModal} onOpenChange={setShowBulkStatusModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {bulkStatusAction === 'deactivate' ? (
                <>
                  <UserX className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  Bulk Deactivate Students
                </>
              ) : (
                <>
                  <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  Bulk Activate Students
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Action Choice */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Action</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={bulkStatusAction === 'deactivate' ? 'default' : 'outline'}
                  className={bulkStatusAction === 'deactivate' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                  onClick={() => setBulkStatusAction('deactivate')}
                >
                  <UserX className="h-4 w-4 mr-2" /> Deactivate
                </Button>
                <Button
                  type="button"
                  variant={bulkStatusAction === 'activate' ? 'default' : 'outline'}
                  className={bulkStatusAction === 'activate' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                  onClick={() => setBulkStatusAction('activate')}
                >
                  <UserCheck className="h-4 w-4 mr-2" /> Activate
                </Button>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Target Scope</Label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  bulkStatusMode === 'selected' ? 'border-[#022172] bg-blue-50/50 dark:bg-blue-950/40' : 'border-border'
                } ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="radio"
                    name="bulkStatusMode"
                    value="selected"
                    disabled={selectedIds.size === 0}
                    checked={bulkStatusMode === 'selected'}
                    onChange={() => setBulkStatusMode('selected')}
                    className="h-4 w-4 text-[#022172]"
                  />
                  <div>
                    <div className="font-medium text-sm">Selected Students List</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedIds.size > 0
                        ? `Apply to the ${selectedIds.size} checked student(s)`
                        : 'Select checkboxes in the table to use this option'}
                    </div>
                  </div>
                </label>

                <div className={`p-3 rounded-lg border transition-colors ${
                  bulkStatusMode === 'grade' ? 'border-[#003dd6] bg-blue-50/50 dark:bg-blue-950/40' : 'border-border'
                }`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="bulkStatusMode"
                      value="grade"
                      checked={bulkStatusMode === 'grade'}
                      onChange={() => setBulkStatusMode('grade')}
                      className="h-4 w-4 text-[#003dd6]"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">By Grade / Class</div>
                      <div className="text-xs text-muted-foreground">
                        Apply to all students enrolled in a specific grade level
                      </div>
                    </div>
                  </label>

                  {bulkStatusMode === 'grade' && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5 pl-7" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-xs font-semibold text-foreground">Select Grade Level:</Label>
                      <Select value={bulkTargetGradeId} onValueChange={setBulkTargetGradeId}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder={loadingGradeLevels ? "Loading grade levels..." : "-- Select Grade Level --"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {gradeLevels.map((gl) => (
                            <SelectItem key={gl.id} value={gl.id}>
                              {gl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  bulkStatusMode === 'school' ? 'border-[#003dd6] bg-blue-50/50 dark:bg-blue-950/40' : 'border-border'
                }`}>
                  <input
                    type="radio"
                    name="bulkStatusMode"
                    value="school"
                    checked={bulkStatusMode === 'school'}
                    onChange={() => setBulkStatusMode('school')}
                    className="h-4 w-4 text-[#003dd6]"
                  />
                  <div>
                    <div className="font-medium text-sm">Whole School / Campus</div>
                    <div className="text-xs text-muted-foreground">
                      Apply to ALL students across the entire school or campus
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Notice / Summary box */}
            <div className="p-3 bg-muted/60 rounded-md border border-border text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Summary:</p>
              {bulkStatusMode === 'selected' && (
                <p>Will {bulkStatusAction} <strong>{selectedIds.size}</strong> student(s) currently selected.</p>
              )}
              {bulkStatusMode === 'grade' && (
                <p>
                  Will {bulkStatusAction} all students enrolled in{' '}
                  <strong>
                    {gradeLevels.find(g => g.id === (bulkTargetGradeId || studentFilters.gradeId))?.name || 'the selected grade level'}
                  </strong>.
                </p>
              )}
              {bulkStatusMode === 'school' && (
                <p>Will {bulkStatusAction} <strong>ALL</strong> students in the school / campus.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              disabled={isUpdatingStatus}
              onClick={() => setShowBulkStatusModal(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isUpdatingStatus || (bulkStatusMode === 'selected' && selectedIds.size === 0)}
              className={bulkStatusAction === 'deactivate' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
              onClick={handleBulkStatusChange}
            >
              {isUpdatingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : bulkStatusAction === 'deactivate' ? (
                <UserX className="h-4 w-4 mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              {isUpdatingStatus
                ? 'Processing...'
                : bulkStatusAction === 'deactivate'
                ? 'Deactivate Now'
                : 'Activate Now'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
