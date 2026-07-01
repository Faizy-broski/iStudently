"use client";

import React, { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { schoolApi } from "@/lib/api/schools";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { GitBranch, ChevronRight, ChevronDown, ChevronUp, Search, Filter, Building2, Mail, Globe, MapPin, Calendar, Edit, Trash2, RefreshCw, User, Shield, LogIn } from "lucide-react";
import EditSchoolModal from "@/components/super-admin/EditSchoolModal";
import EditAdminModal from "@/components/super-admin/EditAdminModal";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import { PaginationWrapper } from "@/components/ui/pagination";
import { useSchools, School } from "@/hooks/useSchools";
import { SchoolSidebarConfigButton } from "@/components/superadmin/SchoolSidebarConfigButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSWRConfig } from "swr";

export default function SchoolDirectoryPage() {
  const { schools, stats, loading, error, refreshSchools, mutate, isValidating } = useSchools();
  const router = useRouter();
  const { mutate: swrMutate } = useSWRConfig();

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
        network.root.status === statusFilter
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

  const enterSchoolDashboard = (school: School) => {
    swrMutate(() => true, undefined, { revalidate: false });
    sessionStorage.setItem('impersonatedSchoolId', school.id);
    sessionStorage.setItem('impersonatedSchoolName', school.name);
    router.push('/admin/dashboard');
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

          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f172a] shadow-sm overflow-hidden w-full">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow className="border-gray-200 dark:border-gray-800 hover:bg-transparent">
                  <TableHead className="font-semibold text-gray-900 dark:text-gray-200 py-4">School</TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-gray-200 py-4">Contact Info</TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-gray-200 py-4">Campuses</TableHead>
                  <TableHead className="font-semibold text-gray-900 dark:text-gray-200 py-4 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedNetworks.map(({ root, branches }) => (
                  <Fragment key={root.id}>
                    <TableRow className="border-gray-200 dark:border-gray-800 dark:hover:bg-gray-800/50 group transition-colors">
                      {/* School Info */}
                      <TableCell className="align-top pt-5 pb-5">
                        <div className="flex items-start gap-4">
                          {root.logo_url ? (
                            <img
                              src={root.logo_url}
                              alt={`${root.name} logo`}
                              className="w-12 h-12 object-cover rounded-md border border-gray-200 dark:border-gray-700 shadow-sm bg-white"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-700">
                              <Building2 className="h-6 w-6 text-[#022172] dark:text-[#57A3CC]" />
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">{root.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">@{root.slug}</span>
                            <Badge variant={root.status === 'active' ? 'default' : 'destructive'}
                              className={`w-fit text-[10px] px-2 py-0.5 mt-1 border-0 uppercase tracking-wider font-semibold ${root.status === 'active' ? "bg-green-500 hover:bg-green-600 dark:bg-green-500/20 dark:text-green-400" : "bg-red-500 hover:bg-red-600 dark:bg-red-500/20 dark:text-red-400"}`}
                            >
                              {root.status}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell className="align-top pt-5 pb-5">
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                            <Mail className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                            <span className="text-sm truncate max-w-[220px] font-medium" title={root.contact_email}>{root.contact_email}</span>
                          </div>
                          {root.website && (
                            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                              <Globe className="h-4 w-4 shrink-0 text-[#57A3CC]" />
                              <a href={root.website} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-[220px] hover:underline hover:text-[#57A3CC] font-medium">
                                {root.website.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                          )}
                          {root.address && (
                            <div className="flex items-start gap-2.5 text-gray-600 dark:text-gray-300">
                              <MapPin className="h-4 w-4 shrink-0 text-[#57A3CC] mt-0.5" />
                              <span className="text-sm line-clamp-2 max-w-[220px]" title={root.address}>{root.address}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Campuses */}
                      <TableCell className="align-top pt-5 pb-5">
                        {branches.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-brand-blue dark:hover:text-[#57A3CC] hover:bg-blue-50 dark:hover:bg-blue-900/20 uppercase tracking-wide border border-transparent hover:border-blue-100 dark:hover:border-blue-800/30"
                            onClick={() => toggleNetwork(root.id)}
                          >
                            <GitBranch className="h-4 w-4 mr-2" />
                            {branches.length} Campus{branches.length !== 1 ? 'es' : ''}
                            {expandedNetworks[root.id] ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1.5 flex items-center font-medium uppercase tracking-wide">
                            <GitBranch className="h-4 w-4 mr-2 opacity-40" />
                            No branches
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-top pt-5 pb-5 pr-6">
                        <div className="flex flex-col gap-2.5 w-[220px] ml-auto">
                          <Button
                            size="sm"
                            className="w-full gradient-blue text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all border-0 h-9 text-xs justify-start font-semibold"
                            onClick={() => enterSchoolDashboard(root)}
                            disabled={root.status === 'suspended'}
                          >
                            <LogIn className="h-4 w-4 mr-2.5" /> Enter Dashboard
                          </Button>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 gradient-blue text-white hover:shadow-md transition-all border-0 opacity-85 hover:opacity-100 h-9 text-xs justify-start px-3 font-medium" onClick={() => setEditingSchool(root)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Button>
                            <Button size="sm" className="flex-1 gradient-orange text-white hover:shadow-md transition-all border-0 h-9 text-xs justify-start px-3 font-medium" onClick={() => setEditingAdmin({ schoolId: root.id, schoolName: root.name })}>
                              <User className="h-4 w-4 mr-2" /> Admin
                            </Button>
                          </div>
                          <div className="w-full text-left [&>button]:justify-start [&>button]:h-9 [&>button]:font-medium">
                            <SchoolSidebarConfigButton schoolId={root.id} schoolName={root.name} />
                          </div>
                          <Button
                            size="sm"
                            className={`w-full h-9 text-white border-0 text-xs justify-start font-medium hover:shadow-md transition-all ${root.status === 'active' ? 'gradient-red hover:shadow-red-500/20' : 'gradient-green hover:shadow-green-500/20'}`}
                            onClick={() => setStatusChangeDialog({ open: true, school: root, newStatus: root.status === 'active' ? 'suspended' : 'active' })}
                          >
                            <Shield className="h-4 w-4 mr-2.5" />
                            {root.status === 'active' ? 'Suspend School Access' : 'Activate School Access'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Branches Rows */}
                    {expandedNetworks[root.id] && branches.map(branch => (
                      <TableRow key={branch.id} className="bg-slate-50/50 dark:bg-slate-800/30 border-gray-100 dark:border-gray-800 border-b-0 last:border-b">
                        <TableCell className="pl-12 pt-4 pb-4 border-l-4 border-l-[#57A3CC] dark:border-l-[#57A3CC]">
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-md border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm">
                              <GitBranch className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-[#022172] dark:text-[#57A3CC]">{branch.name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">@{branch.slug}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="pt-4 pb-4">
                          <div className="flex flex-col gap-2">
                            {branch.contact_email && (
                              <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-[#57A3CC]/70 dark:text-[#57A3CC]" />
                                <span className="text-xs truncate max-w-[200px] font-medium">{branch.contact_email}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-300">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#57A3CC]/70 dark:text-[#57A3CC]" />
                              <span className="text-xs truncate max-w-[200px]" title={branch.address || 'No address provided'}>{branch.address || 'No address provided'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="pt-4 pb-4">
                          <Badge variant={branch.status === 'active' ? 'secondary' : 'destructive'} className={`text-[10px] px-2 py-0.5 border-0 uppercase tracking-wider font-semibold ${branch.status === 'active' ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"}`}>
                            {branch.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pt-4 pb-4 text-right pr-6">
                          <div className="flex justify-end">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 text-xs border-gray-200 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 hover:bg-gray-100 dark:bg-transparent font-medium" 
                              onClick={() => setEditingSchool(branch)}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Branch
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
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
