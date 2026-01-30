"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Edit, MoreHorizontal, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { type Parent } from "@/lib/api/parents";
import { useParents } from "@/hooks/useParents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal";
import { CustomFieldsRenderer } from "@/components/admin/CustomFieldsRenderer";

export default function ParentInfoPage() {
  const { user } = useAuth();
  const schoolId = user?.school_id || '';
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{ id: string, name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [showChildrenDialog, setShowChildrenDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({});

  useEffect(() => {
    if (selectedParent) {
      setEditCustomFields(selectedParent.custom_fields || {});
    }
  }, [selectedParent]);
  const itemsPerPage = 10;

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebouncedValue(searchQuery, 500);

  // Use SWR hook for data fetching with caching
  const { parents, total, totalPages, loading, error, updateParent: updateParentFn, refresh } = useParents({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearch,
  });

  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Refresh data on mount to ensure fresh data
  useEffect(() => {
    if (refresh) {
      refresh();
    }
  }, []); // Empty deps array = runs once on mount

  const handleShowChildren = (parent: Parent) => {
    setSelectedParent(parent);
    setShowChildrenDialog(true);
  };

  const handleViewDetails = (parent: Parent) => {
    setSelectedParent(parent);
    setShowDetailsDialog(true);
  };

  const handleEditParent = (parent: Parent) => {
    setSelectedParent(parent);
    setShowEditDialog(true);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Inactive</Badge>
    );
  };

  const renderChildren = (parent: Parent) => {
    const children = parent.children || [];

    if (children.length === 0) {
      return <span className="text-sm text-muted-foreground">No children</span>;
    }

    if (children.length === 1) {
      const child = children[0];
      const fullName = `${child.profile?.first_name || ''} ${child.profile?.last_name || ''}`.trim();
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{fullName || 'N/A'}</span>
          <span className="text-xs text-muted-foreground">
            {child.student_number} • {child.grade_level || 'N/A'}
          </span>
        </div>
      );
    }

    const firstChild = children[0];
    const fullName = `${firstChild.profile?.first_name || ''} ${firstChild.profile?.last_name || ''}`.trim();
    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{fullName || 'N/A'}</span>
        <button
          onClick={() => handleShowChildren(parent)}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
        >
          +{children.length - 1} more
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Parent Information
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            View all parents and their associated children
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refresh();
            toast.success("Refreshing parent list...");
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        {loading ? (
          <span>Loading...</span>
        ) : (
          <span>Showing {parents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, total)} of {total} parents</span>
        )}
      </div>

      {/* Parents Table */}
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
                    <TableHead>Parent Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Occupation</TableHead>
                    <TableHead>Children</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No parents found matching your search
                      </TableCell>
                    </TableRow>
                  ) : (
                    parents.map((parent) => {
                      const fullName = `${parent.profile?.first_name || ''} ${parent.profile?.last_name || ''}`.trim();
                      const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();

                      return (
                        <TableRow key={parent.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-linear-to-r from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold">
                                {initials || 'N/A'}
                              </div>
                              <div className="font-medium">{fullName || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{parent.profile?.email || 'N/A'}</div>
                              <div className="text-muted-foreground">{parent.profile?.phone || 'N/A'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{parent.occupation || 'N/A'}</span>
                          </TableCell>
                          <TableCell>{renderChildren(parent)}</TableCell>
                          <TableCell>{getStatusBadge(parent.profile?.is_active || false)}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleViewDetails(parent)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setCredentialsData({
                                    id: parent.id,
                                    name: `${parent.profile?.first_name || ''} ${parent.profile?.last_name || ''}`
                                  });
                                  setShowCredentialsModal(true);
                                }}>
                                  <Lock className="mr-2 h-4 w-4" />
                                  Edit Credentials
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditParent(parent)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Parent
                                </DropdownMenuItem>
                                {parent.children && parent.children.length > 0 && (
                                  <DropdownMenuItem onClick={() => handleShowChildren(parent)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View All Children
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {parents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, total)} of {total} parents
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

      {/* Children Dialog */}
      <Dialog open={showChildrenDialog} onOpenChange={setShowChildrenDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Children of {selectedParent?.profile?.first_name} {selectedParent?.profile?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {selectedParent && selectedParent.children && selectedParent.children.length > 0 ? (
              <div className="space-y-3">
                {selectedParent.children.map((child) => {
                  const fullName = `${child.profile?.first_name || ''} ${child.profile?.last_name || ''}`.trim();
                  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase();

                  return (
                    <div
                      key={child.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-linear-to-r from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold text-sm">
                          {initials || 'N/A'}
                        </div>
                        <div>
                          <p className="font-medium">{fullName || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            {child.student_number} • {child.grade_level || 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {child.relationship}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge className="bg-blue-100 text-blue-800 capitalize">
                          {child.relationship}
                        </Badge>
                        {child.is_emergency_contact && (
                          <Badge variant="outline" className="text-xs">
                            Emergency Contact
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No children associated</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parent Details</DialogTitle>
          </DialogHeader>
          {selectedParent && (
            <div className="space-y-6">
              {/* Profile Section */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="h-16 w-16 rounded-full bg-linear-to-r from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold text-xl">
                  {`${selectedParent.profile?.first_name?.[0] || ''}${selectedParent.profile?.last_name?.[0] || ''}`.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedParent.profile?.first_name} {selectedParent.profile?.last_name}
                  </h3>
                  <Badge className={selectedParent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {selectedParent.profile?.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedParent.profile?.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedParent.profile?.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CNIC</p>
                    <p className="font-medium">{selectedParent.cnic || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Professional Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Occupation</p>
                    <p className="font-medium">{selectedParent.occupation || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Workplace</p>
                    <p className="font-medium">{selectedParent.workplace || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Income</p>
                    <p className="font-medium">{selectedParent.income || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Street Address</p>
                    <p className="font-medium">{selectedParent.address || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{selectedParent.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">State</p>
                    <p className="font-medium">{selectedParent.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Zip Code</p>
                    <p className="font-medium">{selectedParent.zip_code || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{selectedParent.country || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              {(selectedParent.emergency_contact_name || selectedParent.emergency_contact_phone) && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Emergency Contact</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedParent.emergency_contact_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Relationship</p>
                      <p className="font-medium">{selectedParent.emergency_contact_relation || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedParent.emergency_contact_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedParent.notes && (
                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Notes</h4>
                  <p className="font-medium whitespace-pre-wrap">{selectedParent.notes}</p>
                </div>
              )}

              {/* Children */}
              <div>
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Children ({selectedParent.children?.length || 0})
                </h4>
                {selectedParent.children && selectedParent.children.length > 0 ? (
                  <div className="space-y-2">
                    {selectedParent.children.map((child) => {
                      const fullName = `${child.profile?.first_name || ''} ${child.profile?.last_name || ''}`.trim();
                      return (
                        <div key={child.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              {child.student_number} • {child.grade_level || 'N/A'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge className="bg-blue-100 text-blue-800 capitalize text-xs">
                              {child.relationship}
                            </Badge>
                            {child.is_emergency_contact && (
                              <Badge variant="outline" className="text-xs">
                                Emergency Contact
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 border rounded-lg">No children associated</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Parent Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Parent Information</DialogTitle>
          </DialogHeader>
          {selectedParent && (
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedParent) return;

              setIsSubmitting(true);
              const formData = new FormData(e.currentTarget);

              try {
                const updateData = {
                  first_name: formData.get('firstName') as string,
                  last_name: formData.get('lastName') as string,
                  email: formData.get('email') as string,
                  phone: formData.get('phone') as string,
                  cnic: formData.get('cnic') as string,
                  occupation: formData.get('occupation') as string,
                  workplace: formData.get('workplace') as string,
                  income: formData.get('income') as string,
                  address: formData.get('address') as string,
                  city: formData.get('city') as string,
                  state: formData.get('state') as string,
                  zip_code: formData.get('zipCode') as string,
                  country: formData.get('country') as string,
                  emergency_contact_name: formData.get('emergencyName') as string,
                  emergency_contact_relation: formData.get('emergencyRelation') as string,
                  emergency_contact_phone: formData.get('emergencyPhone') as string,
                  notes: formData.get('notes') as string,
                  custom_fields: editCustomFields,
                };

                await updateParentFn(selectedParent.id, updateData);
                toast.success('Parent updated successfully!');
                setShowEditDialog(false);
              } catch (error: any) {
                toast.error(error.message || 'Failed to update parent');
                console.error(error);
              } finally {
                setIsSubmitting(false);
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
                      defaultValue={selectedParent.profile?.first_name || ''}
                      placeholder="First Name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-lastName">Last Name</Label>
                    <Input
                      id="edit-lastName"
                      name="lastName"
                      defaultValue={selectedParent.profile?.last_name || ''}
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
                      defaultValue={selectedParent.profile?.email || ''}
                      placeholder="Email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      defaultValue={selectedParent.profile?.phone || ''}
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-cnic">CNIC</Label>
                    <Input
                      id="edit-cnic"
                      name="cnic"
                      defaultValue={selectedParent.cnic || ''}
                      placeholder="XXXXX-XXXXXXX-X"
                    />
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Professional Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-occupation">Occupation</Label>
                    <Input
                      id="edit-occupation"
                      name="occupation"
                      defaultValue={selectedParent.occupation || ''}
                      placeholder="Occupation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-workplace">Workplace</Label>
                    <Input
                      id="edit-workplace"
                      name="workplace"
                      defaultValue={selectedParent.workplace || ''}
                      placeholder="Workplace"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-income">Monthly Income</Label>
                    <Input
                      id="edit-income"
                      name="income"
                      defaultValue={selectedParent.income || ''}
                      placeholder="Income"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit-address">Street Address</Label>
                    <Input
                      id="edit-address"
                      name="address"
                      defaultValue={selectedParent.address || ''}
                      placeholder="Street Address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      name="city"
                      defaultValue={selectedParent.city || ''}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-state">State/Province</Label>
                    <Input
                      id="edit-state"
                      name="state"
                      defaultValue={selectedParent.state || ''}
                      placeholder="State/Province"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-zipCode">Zip Code</Label>
                    <Input
                      id="edit-zipCode"
                      name="zipCode"
                      defaultValue={selectedParent.zip_code || ''}
                      placeholder="Zip Code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-country">Country</Label>
                    <Input
                      id="edit-country"
                      name="country"
                      defaultValue={selectedParent.country || ''}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-emergencyName">Name</Label>
                    <Input
                      id="edit-emergencyName"
                      name="emergencyName"
                      defaultValue={selectedParent.emergency_contact_name || ''}
                      placeholder="Emergency Contact Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-emergencyRelation">Relationship</Label>
                    <Input
                      id="edit-emergencyRelation"
                      name="emergencyRelation"
                      defaultValue={selectedParent.emergency_contact_relation || ''}
                      placeholder="Relationship"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-emergencyPhone">Phone</Label>
                    <Input
                      id="edit-emergencyPhone"
                      name="emergencyPhone"
                      defaultValue={selectedParent.emergency_contact_phone || ''}
                      placeholder="Emergency Phone"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <div className="space-y-4">
                <h4 className="font-semibold mb-3 text-sm">Additional Information</h4>
                <CustomFieldsRenderer
                  entityType="parent"
                  values={editCustomFields}
                  onChange={setEditCustomFields}
                  disabled={isSubmitting}
                />
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={selectedParent.notes || ''}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* Credentials Modal */}
      {credentialsData && (
        <EditCredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => setShowCredentialsModal(false)}
          entityId={credentialsData.id}
          entityName={credentialsData.name}
          entityType="parent"
          schoolId={schoolId}
          onSuccess={() => { }}
        />
      )}
    </div>
  );
}
