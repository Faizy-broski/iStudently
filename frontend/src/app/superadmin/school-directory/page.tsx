"use client";

import { useState, useEffect, useMemo } from "react";
import { schoolApi } from "@/lib/api/schools";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Search, Filter, Building2, Mail, Globe, MapPin, Calendar, Edit, Trash2, RefreshCw, User, Shield } from "lucide-react";
import EditSchoolModal from "@/components/super-admin/EditSchoolModal";
import EditAdminModal from "@/components/super-admin/EditAdminModal";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import { PaginationWrapper } from "@/components/ui/pagination";
import { useSchools, School } from "@/hooks/useSchools";

export default function SchoolDirectoryPage() {
  // Use SWR hook for efficient data fetching
  const { schools, stats, loading, error, refreshSchools, mutate, isValidating } = useSchools();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<{ schoolId: string; schoolName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6); // Show 6 schools per page
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    school: School | null;
    newStatus: "active" | "suspended";
  }>({ open: false, school: null, newStatus: "active" });
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Filter schools based on search and status
  const filteredSchools = useMemo(() => {
    let filtered = schools;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(school => school.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(school =>
        school.name.toLowerCase().includes(query) ||
        school.slug.toLowerCase().includes(query) ||
        school.contact_email.toLowerCase().includes(query) ||
        school.address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, statusFilter, schools]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSchools.length]);

  // Calculate pagination inline
  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedSchools = filteredSchools.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async () => {
    if (!statusChangeDialog.school) return;

    try {
      setIsChangingStatus(true);
      const response = await schoolApi.updateStatus(
        statusChangeDialog.school.id,
        statusChangeDialog.newStatus
      );
      
      if (response.success) {
        toast.success(
          `School ${statusChangeDialog.newStatus === "suspended" ? "suspended" : "activated"} successfully`
        );
        // Refresh SWR data
        mutate();
        setStatusChangeDialog({ open: false, school: null, newStatus: "active" });
      } else {
        toast.error("Failed to update status", {
          description: response.error
        });
      }
    } catch (error: any) {
      toast.error("Error updating status", {
        description: error.message
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleDelete = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Are you sure you want to suspend ${schoolName}?`)) return;

    try {
      const response = await schoolApi.delete(schoolId);
      
      if (response.success) {
        toast.success("School suspended successfully");
        // Refresh SWR data
        mutate();
      } else {
        toast.error("Failed to suspend school", {
          description: response.error
        });
      }
    } catch (error: any) {
      toast.error("Error suspending school", {
        description: error.message
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue">
            School Directory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and view all schools in the system
          </p>
        </div>
        <Button
          onClick={refreshSchools}
          variant="outline"
          disabled={isValidating}
          className="gap-2 hover:gradient-blue hover:text-white transition-all duration-300"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-blue text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Building2 className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-white/80 text-sm mt-1">Total Schools</p>
          </CardContent>
        </Card>
        <Card className="gradient-green text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Building2 className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{stats.active}</div>
            <p className="text-white/80 text-sm mt-1">Active Schools</p>
          </CardContent>
        </Card>
        <Card className="gradient-red text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Building2 className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{stats.suspended}</div>
            <p className="text-white/80 text-sm mt-1">Suspended Schools</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="border-l-4 border-l-[#57A3CC] shadow-md">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#57A3CC]" />
                <Input
                  placeholder="Search by name, slug, email, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC] h-11"
                />
              </div>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC] h-11">
                  <Filter className="h-5 w-5 mr-2 text-[#57A3CC]" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="suspended">Suspended Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schools Grid */}
      {loading ? (
        <Card className="border-gray-200">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Spinner size="lg" className="text-[#57A3CC] mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Schools</h3>
            <p className="text-sm text-gray-500">Please wait while we fetch the school directory...</p>
          </CardContent>
        </Card>
      ) : filteredSchools.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-brand-blue mb-2">No schools found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by onboarding your first school"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Schools count and pagination info */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div>
              Showing <span className="font-semibold text-brand-blue">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-brand-blue">{Math.min(currentPage * itemsPerPage, filteredSchools.length)}</span> of <span className="font-semibold text-brand-blue">{filteredSchools.length}</span> schools
            </div>
            <div className="text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedSchools.map((school) => (
            <Card 
              key={school.id} 
              className="group hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] border-gray-200 hover:border-[#57A3CC] overflow-hidden"
            >
              <CardContent className="p-0">
                {/* Header with gradient overlay */}
                <div className="relative h-24 gradient-blue p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {school.logo_url ? (
                      <img
                        src={school.logo_url}
                        alt={`${school.name} logo`}
                        className="w-14 h-14 object-cover rounded-lg border-2 border-white shadow-lg bg-white"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <Building2 className="h-7 w-7 text-[#022172]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-white line-clamp-1">{school.name}</h3>
                      <p className="text-sm text-white/80">@{school.slug}</p>
                    </div>
                  </div>
                  <Badge
                    variant={school.status === "active" ? "default" : "destructive"}
                    className={`${
                      school.status === "active" 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-red-500 hover:bg-red-600"
                    } text-white border-0`}
                  >
                    {school.status}
                  </Badge>
                </div>

                {/* Content */}
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-gray-700 hover:text-[#57A3CC] transition-colors">
                    <Mail className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                    <span className="truncate text-sm">{school.contact_email}</span>
                  </div>
                  {school.website && (
                    <div className="flex items-center gap-2 text-gray-700 hover:text-[#57A3CC] transition-colors">
                      <Globe className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                      <a
                        href={school.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm hover:underline"
                      >
                        {school.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {school.address && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                      <span className="truncate text-sm">{school.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                    <span className="text-sm">
                      Joined {new Date(school.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 p-4 bg-gray-50 border-t">
                  <Button
                    size="sm"
                    className="w-full gradient-blue hover:shadow-lg hover:scale-105 active:scale-95 justify-start text-white transition-all duration-300"
                    onClick={() => setEditingSchool(school)}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Edit School Info
                  </Button>
                  <Button
                    size="sm"
                    className="w-full gradient-orange hover:shadow-lg hover:scale-105 active:scale-95 justify-start text-white transition-all duration-300"
                    onClick={() => setEditingAdmin({ schoolId: school.id, schoolName: school.name })}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Edit Admin Info
                  </Button>
                  <Button
                    size="sm"
                    className={`w-full justify-start text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 ${
                      school.status === "active" 
                        ? "gradient-red" 
                        : "gradient-green"
                    }`}
                    onClick={() =>
                      setStatusChangeDialog({
                        open: true,
                        school,
                        newStatus: school.status === "active" ? "suspended" : "active"
                      })
                    }
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {school.status === "active" ? "Suspend School" : "Activate School"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <PaginationWrapper
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredSchools.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              variant="gradient"
            />
          )}
        </>
      )}

      {/* Edit Modal */}
      {editingSchool && (
        <EditSchoolModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onSuccess={() => {
            setEditingSchool(null);
            mutate();
          }}
        />
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <EditAdminModal
          schoolId={editingAdmin.schoolId}
          schoolName={editingAdmin.schoolName}
          onClose={() => setEditingAdmin(null)}
          onSuccess={() => {
            setEditingAdmin(null);
            mutate();
          }}
        />
      )}

      {/* Status Change Confirmation Dialog */}
      <ConfirmationDialog
        open={statusChangeDialog.open}
        onOpenChange={(open) =>
          setStatusChangeDialog({ open, school: null, newStatus: "active" })
        }
        title={`${statusChangeDialog.newStatus === "suspended" ? "Suspend" : "Activate"} School?`}
        description={
          statusChangeDialog.school
            ? `Are you sure you want to ${statusChangeDialog.newStatus === "suspended" ? "suspend" : "activate"} "${statusChangeDialog.school.name}"? ${statusChangeDialog.newStatus === "suspended" ? "This will restrict access for all users in this school." : "This will restore access for all users in this school."}`
            : ""
        }
        confirmText={statusChangeDialog.newStatus === "suspended" ? "Suspend" : "Activate"}
        onConfirm={handleStatusChange}
        variant={statusChangeDialog.newStatus === "suspended" ? "destructive" : "default"}
        loading={isChangingStatus}
      />
    </div>
  );
}
