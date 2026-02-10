"use client";

import { useState, useEffect } from "react";
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
  GraduationCap,
  Settings,
  Phone,
  Mail,
  Calendar,
  Building,
  AlertCircle,
  DollarSign,
  Clock,
  BookOpen,
  LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useProfileView } from "@/context/ProfileViewContext";
import { type Staff } from "@/lib/api/teachers";
import { useTeachers } from "@/hooks/useTeachers";
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

export default function TeacherDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { setViewedProfile, clearViewedProfile } = useProfileView();
  
  // Get employee number from URL (URL-encoded, so decode it)
  const employeeNumber = decodeURIComponent(params.employeeNumber as string);
  
  const [currentTeacher, setCurrentTeacher] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personal");

  // Fetch all teachers for navigation
  const { teachers, total, loading: teachersLoading } = useTeachers(1, 1000);

  // Find current teacher index for prev/next navigation
  const currentIndex = teachers.findIndex((t) => t.employee_number === employeeNumber);
  const prevTeacher = currentIndex > 0 ? teachers[currentIndex - 1] : null;
  const nextTeacher = currentIndex < teachers.length - 1 ? teachers[currentIndex + 1] : null;

  // Fetch teacher details
  useEffect(() => {
    const fetchTeacher = async () => {
      setLoading(true);
      try {
        const teacher = teachers.find((t) => t.employee_number === employeeNumber);
        if (teacher) {
          setCurrentTeacher(teacher);
          
          // Update profile view context for sidebar indicator
          const teacherFullName = `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`.trim() || teacher.employee_number;
          setViewedProfile({
            id: teacher.employee_number,
            name: teacherFullName,
            type: 'teacher',
            backUrl: '/admin/teachers'
          });
        }
      } catch (error) {
        console.error("Error fetching teacher:", error);
        toast.error("Failed to load teacher details");
      } finally {
        setLoading(false);
      }
    };

    if (teachers.length > 0) {
      fetchTeacher();
    }
    
    // Clear profile view when leaving the page
    return () => {
      clearViewedProfile();
    };
  }, [employeeNumber, teachers, setViewedProfile, clearViewedProfile]);

  // Navigate using employee_number for readable URLs
  const navigateToTeacher = (teacher: Staff) => {
    router.push(`/admin/teachers/${encodeURIComponent(teacher.employee_number)}`);
  };

  if (loading || teachersLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentTeacher) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Teacher Not Found</h2>
          <p className="text-muted-foreground mb-4">The teacher you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => router.push("/admin/teachers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teachers
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${currentTeacher.profile?.first_name || ""} ${currentTeacher.profile?.last_name || ""}`.trim();

  // Format employment type
  const formatEmploymentType = (type: string | null | undefined) => {
    if (!type) return "N/A";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/teachers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              Teacher Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Viewing {currentIndex + 1} of {total} teachers
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevTeacher}
            onClick={() => prevTeacher && navigateToTeacher(prevTeacher)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextTeacher}
            onClick={() => nextTeacher && navigateToTeacher(nextTeacher)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            onClick={() => router.push(`/admin/teachers/${encodeURIComponent(currentTeacher.employee_number)}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Teacher
          </Button>
        </div>
      </div>

      {/* Teacher Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={currentTeacher.custom_fields?.personal?.photo}
                alt={fullName}
              />
              <AvatarFallback className="text-2xl bg-linear-to-r from-[#57A3CC] to-[#022172] text-white">
                {getInitials(currentTeacher.profile?.first_name, currentTeacher.profile?.last_name)}
              </AvatarFallback>
            </Avatar>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || "N/A"}</h2>
                  <p className="text-muted-foreground">
                    {currentTeacher.employee_number} • {currentTeacher.department || "No Department"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentTeacher.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentTeacher.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {formatEmploymentType(currentTeacher.employment_type)}
                  </Badge>
                </div>
              </div>
              
              {/* Quick Contact Info */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {currentTeacher.profile?.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentTeacher.profile.email}
                  </span>
                )}
                {currentTeacher.profile?.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {currentTeacher.profile.phone}
                  </span>
                )}
                {currentTeacher.title && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    {currentTeacher.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="professional" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Professional</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Subjects</span>
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
                <InfoRow label="First Name" value={currentTeacher.profile?.first_name} />
                <InfoRow label="Last Name" value={currentTeacher.profile?.last_name} />
                <InfoRow label="Email" value={currentTeacher.profile?.email} icon={Mail} />
                <InfoRow label="Phone Number" value={currentTeacher.profile?.phone} icon={Phone} />
                <InfoRow label="Username" value={currentTeacher.profile?.username} icon={User} />
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
                <InfoRow label="Employee Number" value={currentTeacher.employee_number} />
                <InfoRow label="Title" value={currentTeacher.title} icon={Briefcase} />
                <InfoRow label="Department" value={currentTeacher.department} icon={Building} />
                <InfoRow 
                  label="Employment Type" 
                  value={
                    <Badge variant="outline" className="capitalize">
                      {formatEmploymentType(currentTeacher.employment_type)}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Date of Joining" 
                  value={formatDate(currentTeacher.date_of_joining)}
                  icon={Calendar}
                />
                <InfoRow 
                  label="Base Salary" 
                  value={formatCurrency(currentTeacher.base_salary)}
                  icon={DollarSign}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Qualifications" value={currentTeacher.qualifications} icon={GraduationCap} />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Specialization" value={currentTeacher.specialization} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assigned Subjects Tab */}
        <TabsContent value="subjects" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Assigned Subjects & Sections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentTeacher.assigned_subjects && currentTeacher.assigned_subjects.length > 0 ? (
                <div className="space-y-4">
                  {currentTeacher.assigned_subjects.map((assignment, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{assignment.subject?.name || "Unknown Subject"}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.section?.name || "Unknown Section"} • {typeof assignment.section?.grade_level === 'object' ? assignment.section?.grade_level?.name : assignment.section?.grade_level || "N/A"}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {assignment.is_primary ? "Primary Teacher" : "Subject Teacher"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No subjects assigned yet</p>
                  <p className="text-sm">Go to Teacher Workload to assign subjects</p>
                </div>
              )}
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
                <InfoRow label="Teacher ID" value={currentTeacher.id} />
                <InfoRow label="Profile ID" value={currentTeacher.profile_id} />
                <InfoRow label="School ID" value={currentTeacher.school_id} />
                <InfoRow 
                  label="Status" 
                  value={
                    <Badge className={currentTeacher.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentTeacher.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Created At" 
                  value={formatDate(currentTeacher.created_at)}
                  icon={Clock}
                />
                <InfoRow 
                  label="Last Updated" 
                  value={formatDate(currentTeacher.updated_at)}
                  icon={Clock}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
