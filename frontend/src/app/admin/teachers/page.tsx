"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { UserPlus, Search, Edit, Trash2, Users, GraduationCap, Loader2, RefreshCw, ChevronLeft, ChevronRight, Lock, Eye } from "lucide-react"
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal"
import * as teachersApi from "@/lib/api/teachers"
import { useTeachers } from "@/hooks/useTeachers"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { useTranslations } from "next-intl"

export default function TeachersPage() {
  const t = useTranslations("teachers")
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const itemsPerPage = 10

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Use SWR hook for optimized data fetching with pagination
  const {
    teachers,
    total,
    totalPages,
    loading: dataLoading,
    error: dataError,
    deleteTeacher,
    refreshTeachers,
    isValidating
  } = useTeachers(currentPage, itemsPerPage, debouncedSearch)

  // Show error if any
  useEffect(() => {
    if (dataError) {
      toast.error(dataError)
    }
  }, [dataError])

  // Filter by active/inactive status (client-side for now)
  const filteredTeachers = useMemo(() => {
    if (showInactive) return teachers
    return teachers.filter(t => t.is_active !== false)
  }, [teachers, showInactive])

  // State for Edit Credentials Modal
  const [showEditCredentialsModal, setShowEditCredentialsModal] = useState(false)
  const [credentialsEntity, setCredentialsEntity] = useState<{ id: string, name: string } | null>(null)

  const handleEditCredentials = (teacher: teachersApi.Staff) => {
    setCredentialsEntity({
      id: teacher.id,
      name: `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`
    })
    setShowEditCredentialsModal(true)
  }

  const handleEdit = (teacher: teachersApi.Staff) => {
    // Navigate to dedicated edit page
    router.push(`/admin/teachers/${encodeURIComponent(teacher.employee_number)}/edit`)
  }

  const handleDelete = (id: string) => {
    toast(t("deactivatePrompt"), {
      description: t("deactivateDescription"),
      action: {
        label: t("deactivate"),
        onClick: async () => {
          try {
            const response = await deleteTeacher(id)
            if (response.success) {
              toast.success(t("teacherDeactivated"))
            } else {
              toast.error(response.error || t("failedDeactivateTeacher"))
            }
          } catch (error: any) {
            toast.error(error.message || t("failedDeactivateTeacher"))
          }
        },
      },
      cancel: {
        label: t("cancel"),
        onClick: () => {},
      },
    })
  }

  // Loading state
  const loading = dataLoading

  // Helper for employment badge colors
  const getEmploymentBadge = (type: teachersApi.EmploymentType) => {
    const variants: Record<teachersApi.EmploymentType, string> = {
      full_time: "default",
      part_time: "secondary",
      contract: "outline"
    }
    return variants[type] || "default"
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshTeachers()}
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
            {t("refresh")}
          </Button>
          <Button
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white hover:opacity-90 transition-opacity"
            onClick={() => router.push('/admin/teachers/add')}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {t("addTeacherCta")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("totalTeachers")}</p>
                <h3 className="text-2xl font-bold">{total}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-blue flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("activeTeachers")}</p>
                <h3 className="text-2xl font-bold">{filteredTeachers.filter(t => t.is_active !== false).length}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-teal flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("employmentTypes.full_time")}</p>
                <h3 className="text-2xl font-bold">
                  {filteredTeachers.filter(t => t.employment_type === "full_time").length}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-orange flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t("showInactive")}
            </label>
          </div>
        </CardHeader>
      </Card>

      {/* Teachers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <TableHead>{t("table.employeeNumber")}</TableHead>
                    <TableHead>{t("table.name")}</TableHead>
                    <TableHead>{t("table.department")}</TableHead>
                    <TableHead>{t("table.specialization")}</TableHead>
                    <TableHead>{t("table.type")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.contact")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {t("noTeachersFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const fullName =
                        `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`.trim() ||
                        t("na")
                      return (
                        <TableRow 
                          key={teacher.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/admin/teachers/${encodeURIComponent(teacher.employee_number)}`)}
                        >
                          <TableCell className="font-medium">{teacher.employee_number}</TableCell>
                          <TableCell>{fullName}</TableCell>
                          <TableCell>{teacher.department || t("dash")}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {teacher.specialization || t("dash")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEmploymentBadge(teacher.employment_type) as any}>
                              {teacher.employment_type ? t(`employmentTypes.${teacher.employment_type}` as any) : t("na")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={teacher.is_active ? "default" : "secondary"}>
                              {teacher.is_active ? t("active") : t("inactive")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{teacher.profile?.email || t("dash")}</div>
                            <div className="text-muted-foreground">{teacher.profile?.phone || t("dash")}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push(`/admin/teachers/${encodeURIComponent(teacher.employee_number)}`)}
                                title={t("actions.viewDetails")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(teacher)}
                                title={t("actions.editTeacher")}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCredentials(teacher)}
                                title={t("actions.updateCredentials")}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(teacher.id)}
                                title={t("actions.deactivateTeacher")}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("showingResults", {
              from: ((currentPage - 1) * itemsPerPage) + 1,
              to: Math.min(currentPage * itemsPerPage, total),
              total,
            })}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || dataLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  {t("previous")}
                </Button>
              </PaginationItem>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber
                if (totalPages <= 5) {
                  pageNumber = i + 1
                } else if (currentPage <= 3) {
                  pageNumber = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i
                } else {
                  pageNumber = currentPage - 2 + i
                }

                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || dataLoading}
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Edit Credentials Modal */}
      {credentialsEntity && (
        <EditCredentialsModal
          isOpen={showEditCredentialsModal}
          onClose={() => setShowEditCredentialsModal(false)}
          entityId={credentialsEntity.id}
          entityName={credentialsEntity.name}
          entityType="teacher"
          schoolId=""
          onSuccess={() => refreshTeachers()}
        />
      )}
    </div>
  )
}
