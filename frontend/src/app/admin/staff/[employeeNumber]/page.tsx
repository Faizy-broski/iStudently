"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit,
  Loader2,
  User,
  Briefcase,
  Settings,
  Phone,
  Mail,
  Calendar,
  Building,
  AlertCircle,
  DollarSign,
  Clock,
  Shield,
  LucideIcon,
} from "lucide-react";
import { useProfileView } from "@/context/ProfileViewContext";
import { type Staff } from "@/lib/api/staff";
import { useStaff } from "@/hooks/useStaff";
import { useCampus } from "@/context/CampusContext";
import { format } from "date-fns";

// Helper to format dates
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Not provided";
  try {
    return format(new Date(dateString), "MMMM d, yyyy");
  } catch {
    return dateString;
  }
};

// Helper to get initials
const getInitials = (firstName?: string | null, lastName?: string | null) => {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "NA";
};

// Helper to format currency
const formatCurrency = (amount: number | null | undefined) => {
  if (!amount) return "Not set";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Info Row Component
const InfoRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-muted-foreground flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </span>
    <span className="font-medium">{value || <span className="text-muted-foreground italic">Not provided</span>}</span>
  </div>
);

export default function StaffDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { setViewedProfile, clearViewedProfile } = useProfileView();
  const campusContext = useCampus();
  
  // Get employee number from URL (URL-encoded, so decode it)
  const employeeNumber = decodeURIComponent(params.employeeNumber as string);
  
  const [activeTab, setActiveTab] = useState("personal");

  // Fetch all staff for navigation - use same campus filter as the staff list page
  const { staff: staffList, isLoading: staffLoading } = useStaff(1, 1000, undefined, 'all', campusContext?.selectedCampus?.id);
  const total = staffList.length;

  // Find current staff from the list
  const currentStaff = useMemo(() => {
    return staffList.find((s: Staff) => s.employee_number === employeeNumber) || null;
  }, [staffList, employeeNumber]);

  // Find current staff index for prev/next navigation
  const currentIndex = staffList.findIndex((s: Staff) => s.employee_number === employeeNumber);
  const prevStaff = currentIndex > 0 ? staffList[currentIndex - 1] : null;
  const nextStaff = currentIndex < staffList.length - 1 ? staffList[currentIndex + 1] : null;

  // Update profile view context when staff is loaded
  useEffect(() => {
    if (currentStaff) {
      const staffFullName = `${currentStaff.profile?.first_name || ""} ${currentStaff.profile?.last_name || ""}`.trim() || currentStaff.employee_number;
      setViewedProfile({
        id: currentStaff.employee_number,
        name: staffFullName,
        type: 'staff',
        backUrl: '/admin/staff'
      });
    }
    
    // Clear profile view when leaving the page
    return () => {
      clearViewedProfile();
    };
  }, [currentStaff, setViewedProfile, clearViewedProfile]);

  // Navigate using employee_number for readable URLs
  const navigateToStaff = (staff: Staff) => {
    router.push(`/admin/staff/${encodeURIComponent(staff.employee_number)}`);
  };

  if (staffLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentStaff) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Staff Member Not Found</h2>
          <p className="text-muted-foreground mb-4">The staff member you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => router.push("/admin/staff")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Staff
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${currentStaff.profile?.first_name || ""} ${currentStaff.profile?.last_name || ""}`.trim();

  // Format employment type
  const formatEmploymentType = (type: string | null | undefined) => {
    if (!type) return "N/A";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  // Get role display name
  const getRoleDisplay = (role: string | null | undefined) => {
    if (!role) return "Staff";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/staff")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              Staff Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Viewing {currentIndex + 1} of {total} staff members
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevStaff}
            onClick={() => prevStaff && navigateToStaff(prevStaff)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextStaff}
            onClick={() => nextStaff && navigateToStaff(nextStaff)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            onClick={() => router.push(`/admin/staff?edit=${currentStaff.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Staff
          </Button>
        </div>
      </div>

      {/* Staff Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={currentStaff.custom_fields?.personal?.photo}
                alt={fullName}
              />
              <AvatarFallback className="text-2xl bg-linear-to-r from-[#57A3CC] to-[#022172] text-white">
                {getInitials(currentStaff.profile?.first_name, currentStaff.profile?.last_name)}
              </AvatarFallback>
            </Avatar>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || "N/A"}</h2>
                  <p className="text-muted-foreground">
                    {currentStaff.employee_number} • {currentStaff.department || "No Department"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentStaff.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentStaff.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {getRoleDisplay((currentStaff.profile as any)?.role)}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {formatEmploymentType(currentStaff.employment_type)}
                  </Badge>
                </div>
              </div>
              
              {/* Quick Contact Info */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {currentStaff.profile?.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentStaff.profile.email}
                  </span>
                )}
                {currentStaff.profile?.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {currentStaff.profile.phone}
                  </span>
                )}
                {currentStaff.title && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    {currentStaff.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="professional" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Professional</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label="First Name" value={currentStaff.profile?.first_name} />
                <InfoRow label="Last Name" value={currentStaff.profile?.last_name} />
                <InfoRow label="Email" value={currentStaff.profile?.email} icon={Mail} />
                <InfoRow label="Phone Number" value={currentStaff.profile?.phone} icon={Phone} />
                <InfoRow label="Username" value={currentStaff.profile?.username} icon={User} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Information Tab */}
        <TabsContent value="professional" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Professional Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label="Employee Number" value={currentStaff.employee_number} />
                <InfoRow label="Title" value={currentStaff.title} icon={Briefcase} />
                <InfoRow label="Department" value={currentStaff.department} icon={Building} />
                <InfoRow 
                  label="Role" 
                  value={
                    <Badge variant="outline" className="capitalize">
                      {getRoleDisplay((currentStaff.profile as any)?.role)}
                    </Badge>
                  }
                  icon={Shield}
                />
                <InfoRow 
                  label="Employment Type" 
                  value={
                    <Badge variant="secondary" className="capitalize">
                      {formatEmploymentType(currentStaff.employment_type)}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Date of Joining" 
                  value={formatDate(currentStaff.date_of_joining)}
                  icon={Calendar}
                />
                <InfoRow 
                  label="Base Salary" 
                  value={formatCurrency(currentStaff.base_salary)}
                  icon={DollarSign}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Qualifications" value={currentStaff.qualifications} />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Specialization" value={currentStaff.specialization} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Information Tab */}
        <TabsContent value="system" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label="Staff ID" value={currentStaff.id} />
                <InfoRow label="Profile ID" value={currentStaff.profile_id} />
                <InfoRow label="School ID" value={currentStaff.school_id} />
                <InfoRow 
                  label="Status" 
                  value={
                    <Badge className={currentStaff.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentStaff.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Created At" 
                  value={formatDate(currentStaff.created_at)}
                  icon={Clock}
                />
                <InfoRow 
                  label="Last Updated" 
                  value={formatDate(currentStaff.updated_at)}
                  icon={Clock}
                />
              </div>

              {/* Permissions */}
              {currentStaff.permissions && Object.keys(currentStaff.permissions).length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permissions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(currentStaff.permissions).map(([key, value]) => (
                      value && (
                        <Badge key={key} variant="outline" className="capitalize">
                          {key.replace(/_/g, ' ')}
                        </Badge>
                      )
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
