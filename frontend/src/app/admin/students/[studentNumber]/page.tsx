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
  GraduationCap,
  Heart,
  Users,
  Settings,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Building,
  AlertCircle,
  BookOpen,
  Shield,
  LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { useProfileView } from "@/context/ProfileViewContext";
import { type Student } from "@/lib/api/students";
import { useStudents } from "@/hooks/useStudents";
import { getParentById, type Parent } from "@/lib/api/parents";
import { format } from "date-fns";

// Type for emergency contacts stored in custom_fields
interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
  address?: string;
}

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

export default function StudentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campusContext = useCampus();
  const { setViewedProfile, clearViewedProfile } = useProfileView();
  
  // Get student number from URL (URL-encoded, so decode it)
  const studentNumber = decodeURIComponent(params.studentNumber as string);
  
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedParent, setLinkedParent] = useState<Parent | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  // Fetch all students for navigation
  const { students, total, loading: studentsLoading } = useStudents({
    page: 1,
    limit: 1000, // Get all for navigation
  });

  // Find current student index for prev/next navigation (by student_number)
  const currentIndex = students.findIndex((s) => s.student_number === studentNumber);
  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex < students.length - 1 ? students[currentIndex + 1] : null;

  // Fetch student details
  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true);
      try {
        // Find student from the list by student_number
        const student = students.find((s) => s.student_number === studentNumber);
        if (student) {
          setCurrentStudent(student);
          
          // Update profile view context for sidebar indicator
          const studentFullName = `${student.profile?.first_name || ""} ${student.profile?.father_name || ""}`.trim() || student.student_number;
          setViewedProfile({
            id: student.student_number,
            name: studentFullName,
            type: 'student',
            backUrl: '/admin/students/student-info'
          });
          
          // Fetch linked parent if exists
          const parentId = student.custom_fields?.family?.linked_parent_id;
          if (parentId) {
            setLoadingParent(true);
            try {
              const parentResponse = await getParentById(parentId);
              if (parentResponse.success && parentResponse.data) {
                setLinkedParent(parentResponse.data);
              }
            } catch (err) {
              console.error("Error fetching parent:", err);
            } finally {
              setLoadingParent(false);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching student:", error);
        toast.error("Failed to load student details");
      } finally {
        setLoading(false);
      }
    };

    if (students.length > 0) {
      fetchStudent();
    }
    
    // Clear profile view when leaving the page
    return () => {
      clearViewedProfile();
    };
  }, [studentNumber, students, setViewedProfile, clearViewedProfile]);

  // Navigate using student_number for readable URLs
  const navigateToStudent = (student: Student) => {
    router.push(`/admin/students/${encodeURIComponent(student.student_number)}`);
  };

  if (loading || studentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentStudent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Student Not Found</h2>
          <p className="text-muted-foreground mb-4">The student you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => router.push("/admin/students/student-info")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
        </div>
      </div>
    );
  }

  // Get section info from custom_fields if available
  const sectionName = currentStudent.custom_fields?.academic?.section_name;
  const campusName = currentStudent.custom_fields?.academic?.campus_name || campusContext?.selectedCampus?.name;
  const academicYearName = currentStudent.custom_fields?.academic?.academic_year_name;

  const fullName = `${currentStudent.profile?.first_name || ""} ${currentStudent.profile?.father_name || ""} ${currentStudent.profile?.grandfather_name || ""} ${currentStudent.profile?.last_name || ""}`.trim().replace(/\s+/g, " ");

  return (
    <div className="p-6 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/students/student-info")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              Student Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Viewing {currentIndex + 1} of {total} students
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevStudent}
            onClick={() => prevStudent && navigateToStudent(prevStudent)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextStudent}
            onClick={() => nextStudent && navigateToStudent(nextStudent)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            onClick={() => router.push(`/admin/students/student-info?edit=${currentStudent.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Student
          </Button>
        </div>
      </div>

      {/* Student Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={currentStudent.profile?.profile_photo_url || currentStudent.custom_fields?.personal?.student_photo}
                alt={fullName}
              />
              <AvatarFallback className="text-2xl bg-linear-to-r from-[#57A3CC] to-[#022172] text-white">
                {getInitials(currentStudent.profile?.first_name, currentStudent.profile?.last_name)}
              </AvatarFallback>
            </Avatar>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || "N/A"}</h2>
                  <p className="text-muted-foreground">
                    {currentStudent.student_number} • {sectionName || "No Section"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentStudent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentStudent.profile?.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {currentStudent.custom_fields?.personal?.gender && (
                    <Badge variant="outline" className="capitalize">
                      {currentStudent.custom_fields.personal.gender}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Quick Contact Info */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {currentStudent.profile?.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentStudent.profile.email}
                  </span>
                )}
                {currentStudent.profile?.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {currentStudent.profile.phone}
                  </span>
                )}
                {currentStudent.grade_level && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <GraduationCap className="h-4 w-4" />
                    {currentStudent.grade_level}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Academic</span>
          </TabsTrigger>
          <TabsTrigger value="medical" className="gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Medical</span>
          </TabsTrigger>
          <TabsTrigger value="family" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Family</span>
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
                <InfoRow label="First Name" value={currentStudent.profile?.first_name} />
                <InfoRow label="Father's Name" value={currentStudent.profile?.father_name} />
                <InfoRow label="Grandfather's Name" value={currentStudent.profile?.grandfather_name} />
                <InfoRow label="Surname / Last Name" value={currentStudent.profile?.last_name} />
                <InfoRow 
                  label="Date of Birth" 
                  value={formatDate(currentStudent.custom_fields?.personal?.date_of_birth)}
                  icon={Calendar}
                />
                <InfoRow 
                  label="Gender" 
                  value={
                    currentStudent.custom_fields?.personal?.gender ? (
                      <Badge variant="outline" className="capitalize">
                        {currentStudent.custom_fields.personal.gender}
                      </Badge>
                    ) : null
                  }
                />
                <InfoRow label="Email" value={currentStudent.profile?.email} icon={Mail} />
                <InfoRow label="Phone Number" value={currentStudent.profile?.phone} icon={Phone} />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Address" value={currentStudent.custom_fields?.personal?.address} icon={MapPin} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Academic Information Tab */}
        <TabsContent value="academic" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Academic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label="Student Number / Roll No" value={currentStudent.student_number} />
                <InfoRow label="Grade Level" value={currentStudent.grade_level} icon={BookOpen} />
                <InfoRow 
                  label="Section" 
                  value={sectionName}
                  icon={Building}
                />
                <InfoRow 
                  label="Campus" 
                  value={campusName}
                  icon={Building}
                />
                <InfoRow 
                  label="Admission Date" 
                  value={formatDate(currentStudent.custom_fields?.academic?.admission_date)}
                  icon={Calendar}
                />
                <InfoRow 
                  label="Academic Year" 
                  value={academicYearName}
                />
              </div>
              
              {/* Previous School History */}
              {currentStudent.custom_fields?.academic?.previous_school && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4">Previous School History</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoRow 
                      label="School Name" 
                      value={currentStudent.custom_fields.academic.previous_school.schoolName}
                    />
                    <InfoRow 
                      label="Last Grade Completed" 
                      value={currentStudent.custom_fields.academic.previous_school.lastGradeCompleted}
                    />
                    <InfoRow 
                      label="Transfer Date" 
                      value={currentStudent.custom_fields.academic.previous_school.transferDate}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Information Tab */}
        <TabsContent value="medical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Medical Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow 
                  label="Blood Group" 
                  value={
                    currentStudent.medical_info?.blood_group ? (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {currentStudent.medical_info.blood_group}
                      </Badge>
                    ) : null
                  }
                />
                <InfoRow 
                  label="Has Allergies" 
                  value={
                    currentStudent.medical_info?.allergies && currentStudent.medical_info.allergies.length > 0 ? (
                      <Badge variant="destructive">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )
                  }
                />
              </div>
              
              {/* Allergies List */}
              {currentStudent.medical_info?.allergies && currentStudent.medical_info.allergies.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm text-muted-foreground mb-2">Allergies</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentStudent.medical_info.allergies.map((allergy, idx) => (
                      <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Medical Notes */}
              {currentStudent.medical_info?.emergency_notes && (
                <div className="mt-6">
                  <h4 className="text-sm text-muted-foreground mb-2">Medical Notes</h4>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="whitespace-pre-wrap">{currentStudent.medical_info.emergency_notes}</p>
                  </div>
                </div>
              )}

              {/* No medical info placeholder */}
              {!currentStudent.medical_info?.blood_group && 
               (!currentStudent.medical_info?.allergies || currentStudent.medical_info.allergies.length === 0) &&
               !currentStudent.medical_info?.emergency_notes && (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No medical information recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Family & Emergency Tab */}
        <TabsContent value="family" className="mt-6 space-y-6">
          {/* Linked Parent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Linked Parent / Guardian
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingParent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : linkedParent ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={linkedParent.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(linkedParent.profile?.first_name, linkedParent.profile?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">
                        {linkedParent.profile?.first_name} {linkedParent.profile?.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {currentStudent.custom_fields?.family?.parent_relation_type || "Guardian"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <InfoRow label="Email" value={linkedParent.profile?.email} icon={Mail} />
                    <InfoRow label="Phone" value={linkedParent.profile?.phone} icon={Phone} />
                    <InfoRow label="CNIC" value={linkedParent.cnic} />
                    <InfoRow label="Occupation" value={linkedParent.occupation} />
                    <InfoRow label="Workplace" value={linkedParent.workplace} />
                    <InfoRow label="Address" value={linkedParent.address} icon={MapPin} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No parent/guardian linked to this student</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Emergency Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentStudent.custom_fields?.family?.emergency_contacts && 
               currentStudent.custom_fields.family.emergency_contacts.length > 0 ? (
                <div className="space-y-4">
                  {(currentStudent.custom_fields.family.emergency_contacts as EmergencyContact[]).map((contact, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{contact.name || "N/A"}</h4>
                          <p className="text-sm text-muted-foreground capitalize">{contact.relationship || "Contact"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoRow label="Phone" value={contact.phone} icon={Phone} />
                        {contact.address && <InfoRow label="Address" value={contact.address} icon={MapPin} />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No emergency contacts recorded</p>
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
                <InfoRow label="Student ID" value={currentStudent.student_number} icon={Shield} />
                <InfoRow 
                  label="Username" 
                  value={currentStudent.custom_fields?.system?.username}
                />
                <InfoRow 
                  label="Account Status" 
                  value={
                    <Badge className={currentStudent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentStudent.profile?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Created At" 
                  value={formatDate(currentStudent.created_at)}
                  icon={Clock}
                />
                <InfoRow 
                  label="Profile ID" 
                  value={<code className="text-xs bg-muted px-2 py-1 rounded">{currentStudent.profile_id}</code>}
                />
                <InfoRow 
                  label="Student Record ID" 
                  value={<code className="text-xs bg-muted px-2 py-1 rounded">{currentStudent.id}</code>}
                />
              </div>

              {/* Services Subscribed */}
              {currentStudent.custom_fields?.services?.selected_services && 
               currentStudent.custom_fields.services.selected_services.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4">Subscribed Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentStudent.custom_fields.services.selected_services.map((serviceId: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {serviceId}
                      </Badge>
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
