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
import { GitBranch, ChevronRight, ChevronDown, ChevronUp, Search, Filter, Building2, Mail, Globe, MapPin, Calendar, Edit, Trash2, RefreshCw, User, Shield } from "lucide-react";
import EditSchoolModal from "@/components/super-admin/EditSchoolModal";
import EditAdminModal from "@/components/super-admin/EditAdminModal";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import { PaginationWrapper } from "@/components/ui/pagination";
import { useSchools, School } from "@/hooks/useSchools";

export default function SchoolDirectoryPage() {
  const { schools, stats, loading, error, refreshSchools, mutate, isValidating } = useSchools();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<{ schoolId: string; schoolName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    school: School | null;
    newStatus: "active" | "suspended";
  }>({ open: false, school: null, newStatus: "active" });
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [expandedNetworks, setExpandedNetworks] = useState<Record<string, boolean>>({});

  const schoolNetworks = useMemo(() => {
    const networks: Record<string, { root: School; branches: School[] }> = {};
    const roots = schools.filter(s => !s.parent_school_id);
    const branches = schools.filter(s => s.parent_school_id);

    roots.forEach(root => {
      networks[root.id] = { root, branches: [] };
    });

    branches.forEach(branch => {
      if (branch.parent_school_id && networks[branch.parent_school_id]) {
        networks[branch.parent_school_id].branches.push(branch);
      } else {
        networks[branch.id] = { root: branch, branches: [] };
      }
    });

    return Object.values(networks);
  }, [schools]);

  const filteredNetworks = useMemo(() => {
    let filtered = schoolNetworks;

    if (statusFilter !== "all") {
      filtered = filtered.filter(network =>
        network.root.status === statusFilter ||
        network.branches.some(b => b.status === statusFilter)
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(network =>
        network.root.name.toLowerCase().includes(query) ||
        network.root.slug.toLowerCase().includes(query) ||
        network.branches.some(b => b.name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [schoolNetworks, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredNetworks.length]);

  const totalPages = Math.ceil(filteredNetworks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedNetworks = filteredNetworks.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleNetwork = (id: string) => {
    setExpandedNetworks(prev => ({ ...prev, [id]: !prev[id] }));
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
        mutate();
        setStatusChangeDialog({ open: false, school: null, newStatus: "active" });
      } else {
        toast.error("Failed to update status", { description: response.error });
      }
    } catch (error: any) {
      toast.error("Error updating status", { description: error.message });
    } finally {
      setIsChangingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats Cards (Same as before) */}
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

      {loading ? (
        <Card className="border-gray-200">
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Spinner size="lg" className="text-[#57A3CC] mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Schools</h3>
            <p className="text-sm text-gray-500">Please wait while we fetch the school directory...</p>
          </CardContent>
        </Card>
      ) : filteredNetworks.length === 0 ? (
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
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div>
              Showing <span className="font-semibold text-brand-blue">{startIndex + 1}</span> to <span className="font-semibold text-brand-blue">{Math.min(endIndex, filteredNetworks.length)}</span> of <span className="font-semibold text-brand-blue">{filteredNetworks.length}</span> networks
            </div>
            <div className="text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
          </div>

          {/* GRID LAYOUT for Networks */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedNetworks.map(({ root, branches }) => (
              <Card
                key={root.id}
                className="group flex flex-col overflow-hidden border-gray-200 hover:border-[#57A3CC] transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
              >
                {/* Standard Vertical Card Header */}
                <div className="relative h-24 gradient-blue p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {root.logo_url ? (
                      <img
                        src={root.logo_url}
                        alt={`${root.name} logo`}
                        className="w-14 h-14 object-cover rounded-lg border-2 border-white shadow-lg bg-white"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <Building2 className="h-7 w-7 text-[#022172]" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-white line-clamp-1">{root.name}</h3>
                      <p className="text-sm text-white/80">@{root.slug}</p>
                    </div>
                  </div>
                  <Badge variant={root.status === 'active' ? 'default' : 'destructive'}
                    className={`${root.status === 'active' ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} text-white border-0`}
                  >
                    {root.status}
                  </Badge>
                </div>

                <div className="p-6 space-y-3 flex-1">
                  <div className="flex items-center gap-2 text-gray-700 hover:text-[#57A3CC] transition-colors">
                    <Mail className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                    <span className="truncate text-sm">{root.contact_email}</span>
                  </div>
                  {root.website && (
                    <div className="flex items-center gap-2 text-gray-700 hover:text-[#57A3CC] transition-colors">
                      <Globe className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                      <a href={root.website} target="_blank" className="truncate text-sm hover:underline">
                        {root.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {root.address && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                      <span className="truncate text-sm">{root.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                    <span className="text-sm">
                      Joined {new Date(root.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-4 bg-gray-50 border-t flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gradient-blue text-white hover:shadow-md transition-all border-0" onClick={() => setEditingSchool(root)}>
                      <Edit className="h-3 w-3 mr-2" /> Edit Info
                    </Button>
                    <Button size="sm" className="flex-1 gradient-orange text-white hover:shadow-md transition-all border-0" onClick={() => setEditingAdmin({ schoolId: root.id, schoolName: root.name })}>
                      <User className="h-3 w-3 mr-2" /> Admin
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className={`w-full h-8 text-white border-0 ${root.status === 'active' ? 'gradient-red' : 'gradient-green'}`}
                    onClick={() => setStatusChangeDialog({ open: true, school: root, newStatus: root.status === 'active' ? 'suspended' : 'active' })}
                  >
                    <Shield className="h-3 w-3 mr-2" />
                    {root.status === 'active' ? 'Suspend School Access' : 'Activate School Access'}
                  </Button>
                </div>

                {/* Branches Section (Collapsible within card) */}
                {branches.length > 0 && (
                  <div className="bg-slate-50 border-t border-gray-200">
                    <button
                      onClick={() => toggleNetwork(root.id)}
                      className="w-full h-10 flex items-center justify-between px-4 text-xs font-bold text-gray-700 hover:text-brand-blue hover:bg-white transition-colors uppercase tracking-wide"
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <span>{branches.length} Branch Campus{branches.length !== 1 ? 'es' : ''}</span>
                      </div>
                      {expandedNetworks[root.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {expandedNetworks[root.id] && (
                      <div className="px-4 pb-4 pt-2 grid grid-cols-1 gap-3">
                        {branches.map(branch => (
                          <div key={branch.id} className="bg-white rounded-lg border-l-4 border-l-[#57A3CC] border-y border-r border-gray-200 shadow-sm p-3 flex flex-col gap-2 group hover:shadow-md transition-all">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-[#022172] text-sm leading-tight group-hover:text-[#57A3CC] transition-colors">{branch.name}</h4>
                                <span className="text-xs text-slate-500 font-mono">@{branch.slug}</span>
                              </div>
                              <Badge variant={branch.status === 'active' ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 h-5">
                                {branch.status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1 border-t border-gray-50 mt-1">
                              <MapPin className="h-3 w-3 text-[#57A3CC]" />
                              <span className="truncate">{branch.address || 'No address provided'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <PaginationWrapper
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredNetworks.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              variant="gradient"
            />
          )}

        </>
      )}

      {/* Modals remain the same */}
      {editingSchool && (
        <EditSchoolModal
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onSuccess={() => { setEditingSchool(null); mutate(); }}
        />
      )}
      {editingAdmin && (
        <EditAdminModal
          schoolId={editingAdmin.schoolId}
          schoolName={editingAdmin.schoolName}
          onClose={() => setEditingAdmin(null)}
          onSuccess={() => { setEditingAdmin(null); mutate(); }}
        />
      )}
      <ConfirmationDialog
        open={statusChangeDialog.open}
        onOpenChange={(open) => setStatusChangeDialog({ open, school: null, newStatus: "active" })}
        title={`${statusChangeDialog.newStatus === "suspended" ? "Suspend" : "Activate"} School?`}
        description={statusChangeDialog.school ? `Are you sure you want to ${statusChangeDialog.newStatus === "suspended" ? "suspend" : "activate"} "${statusChangeDialog.school.name}"?` : ""}
        confirmText={statusChangeDialog.newStatus === "suspended" ? "Suspend" : "Activate"}
        onConfirm={handleStatusChange}
        variant={statusChangeDialog.newStatus === "suspended" ? "destructive" : "default"}
        loading={isChangingStatus}
      />
    </div>
  );
}
