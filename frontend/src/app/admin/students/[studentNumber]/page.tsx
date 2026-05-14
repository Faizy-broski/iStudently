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
import { useSchoolSettings } from "@/context/SchoolSettingsContext";
import { type Student } from "@/lib/api/students";
import { useStudents } from "@/hooks/useStudents";
import { getParentById, type Parent } from "@/lib/api/parents";
import { format } from "date-fns";
import DisciplineScoreTab from "@/components/admin/DisciplineScoreTab";
import RelativesTab from "@/components/admin/RelativesTab";
import { useTranslations } from "next-intl";

interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
  address?: string;
}

const getInitials = (firstName?: string | null, lastName?: string | null) => {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "NA";
};

export default function StudentDetailsPage() {
  const t = useTranslations("school.students.student_details");
  const tFields = useTranslations("school.students.fields");
  const params = useParams();
  const router = useRouter();
  const campusContext = useCampus();
  const { setViewedProfile, clearViewedProfile } = useProfileView();
  const { isPluginActive } = useSchoolSettings();
  const disciplineScoreActive = isPluginActive('discipline_score');
  const relativesActive = isPluginActive('relatives');
  const prevNextEnabled = isPluginActive('previous_next_student');

  const studentNumber = decodeURIComponent(params.studentNumber as string);

  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedParent, setLinkedParent] = useState<Parent | null>(null);
  const [loadingParent, setLoadingParent] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  const { students, total, loading: studentsLoading } = useStudents(
    prevNextEnabled ? { page: 1, limit: 1000 } : { page: 1, limit: 0 }
  );

  const currentIndex = prevNextEnabled ? students.findIndex((s) => s.student_number === studentNumber) : -1;
  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex < students.length - 1 ? students[currentIndex + 1] : null;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return t("not_provided");
    try {
      return format(new Date(dateString), "MMMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const InfoRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) => (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span className="font-medium">{value || <span className="text-muted-foreground italic">{t("not_provided")}</span>}</span>
    </div>
  );

  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true);
      try {
        const student = students.find((s) => s.student_number === studentNumber);
        if (student) {
          setCurrentStudent(student);

          const studentFullName = `${student.profile?.first_name || ""} ${student.profile?.father_name || ""}`.trim() || student.student_number;
          setViewedProfile({
            id: student.student_number,
            name: studentFullName,
            type: 'student',
            backUrl: '/admin/students/student-info'
          });

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

    return () => {
      clearViewedProfile();
    };
  }, [studentNumber, students, setViewedProfile, clearViewedProfile]);

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
          <h2 className="text-xl font-semibold mb-2">{t("not_found_title")}</h2>
          <p className="text-muted-foreground mb-4">{t("not_found_desc")}</p>
          <Button onClick={() => router.push("/admin/students/student-info")}>
            <ArrowLeft className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" />
            {t("back_to_students")}
          </Button>
        </div>
      </div>
    );
  }

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
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              {t("title")}
            </h1>
            {prevNextEnabled && (
              <p className="text-sm text-muted-foreground">
                {t("viewing_of", { current: currentIndex + 1, total })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {prevNextEnabled && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={!prevStudent}
                onClick={() => prevStudent && navigateToStudent(prevStudent)}
              >
                <ChevronLeft className="h-4 w-4 mr-1 rtl:rotate-180 rtl:ml-1 rtl:mr-0" />
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!nextStudent}
                onClick={() => nextStudent && navigateToStudent(nextStudent)}
              >
                {t("next")}
                <ChevronRight className="h-4 w-4 ml-1 rtl:rotate-180 rtl:mr-1 rtl:ml-0" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}
          <Button
            onClick={() => router.push(`/admin/students/student-info?edit=${currentStudent.id}`)}
          >
            <Edit className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t("edit_student")}
          </Button>
        </div>
      </div>

      {/* Student Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={currentStudent.profile?.profile_photo_url || currentStudent.custom_fields?.personal?.student_photo}
                alt={fullName}
              />
              <AvatarFallback className="text-2xl bg-linear-to-r from-[#57A3CC] to-[#022172] text-white">
                {getInitials(currentStudent.profile?.first_name, currentStudent.profile?.last_name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || tCommon("noData")}</h2>
                  <p className="text-muted-foreground">
                    {currentStudent.student_number} • {sectionName || t("no_section")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentStudent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentStudent.profile?.is_active ? t("active") : t("inactive")}
                  </Badge>
                  {currentStudent.custom_fields?.personal?.gender && (
                    <Badge variant="outline" className="capitalize">
                      {currentStudent.custom_fields.personal.gender}
                    </Badge>
                  )}
                </div>
              </div>

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
        <TabsList className={`grid w-full lg:w-auto lg:inline-grid ${[disciplineScoreActive, relativesActive].filter(Boolean).length === 2 ? 'grid-cols-7' : [disciplineScoreActive, relativesActive].filter(Boolean).length === 1 ? 'grid-cols-6' : 'grid-cols-5'}`}>
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tab_personal")}</span>
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tab_academic")}</span>
          </TabsTrigger>
          <TabsTrigger value="medical" className="gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tab_medical")}</span>
          </TabsTrigger>
          <TabsTrigger value="family" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tab_family")}</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tab_system")}</span>
          </TabsTrigger>
          {disciplineScoreActive && (
            <TabsTrigger value="discipline" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t("tab_discipline")}</span>
            </TabsTrigger>
          )}
          {relativesActive && (
            <TabsTrigger value="relatives" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t("tab_relatives")}</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("personal_info")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label={tFields("first_name")} value={currentStudent.profile?.first_name} />
                <InfoRow label={tFields("father_name")} value={currentStudent.profile?.father_name} />
                <InfoRow label={tFields("grandfather_name")} value={currentStudent.profile?.grandfather_name} />
                <InfoRow label={tFields("last_name")} value={currentStudent.profile?.last_name} />
                <InfoRow
                  label={tFields("date_of_birth")}
                  value={formatDate(currentStudent.custom_fields?.personal?.date_of_birth)}
                  icon={Calendar}
                />
                <InfoRow
                  label={tFields("gender")}
                  value={
                    currentStudent.custom_fields?.personal?.gender ? (
                      <Badge variant="outline" className="capitalize">
                        {currentStudent.custom_fields.personal.gender}
                      </Badge>
                    ) : null
                  }
                />
                <InfoRow label={tFields("email")} value={currentStudent.profile?.email} icon={Mail} />
                <InfoRow label={tFields("phone_number")} value={currentStudent.profile?.phone} icon={Phone} />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label={tFields("address")} value={currentStudent.custom_fields?.personal?.address} icon={MapPin} />
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
                {t("academic_info")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label={t("student_number")} value={currentStudent.student_number} />
                <InfoRow label={t("grade_level")} value={currentStudent.grade_level} icon={BookOpen} />
                <InfoRow label={t("section")} value={sectionName} icon={Building} />
                <InfoRow label={t("campus")} value={campusName} icon={Building} />
                <InfoRow
                  label={tFields("admission_date")}
                  value={formatDate(currentStudent.custom_fields?.academic?.admission_date)}
                  icon={Calendar}
                />
                <InfoRow label={t("academic_year")} value={academicYearName} />
              </div>

              {currentStudent.custom_fields?.academic?.previous_school && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4">{tFields("previous_school")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoRow
                      label={t("school_name")}
                      value={currentStudent.custom_fields.academic.previous_school.schoolName}
                    />
                    <InfoRow
                      label={t("enrollment_date")}
                      value={currentStudent.custom_fields.academic.previous_school.lastGradeCompleted}
                    />
                    <InfoRow
                      label={t("transfer_date")}
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
                {t("medical_info")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow
                  label={t("blood_group")}
                  value={
                    currentStudent.medical_info?.blood_group ? (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {currentStudent.medical_info.blood_group}
                      </Badge>
                    ) : null
                  }
                />
                <InfoRow
                  label={t("allergies")}
                  value={
                    currentStudent.medical_info?.allergies && currentStudent.medical_info.allergies.length > 0 ? (
                      <Badge variant="destructive">{t("yes")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("no")}</Badge>
                    )
                  }
                />
              </div>

              {currentStudent.medical_info?.allergies && currentStudent.medical_info.allergies.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm text-muted-foreground mb-2">{t("allergies")}</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentStudent.medical_info.allergies.map((allergy, idx) => (
                      <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {currentStudent.medical_info?.emergency_notes && (
                <div className="mt-6">
                  <h4 className="text-sm text-muted-foreground mb-2">{tFields("medical_notes")}</h4>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="whitespace-pre-wrap">{currentStudent.medical_info.emergency_notes}</p>
                  </div>
                </div>
              )}

              {!currentStudent.medical_info?.blood_group &&
               (!currentStudent.medical_info?.allergies || currentStudent.medical_info.allergies.length === 0) &&
               !currentStudent.medical_info?.emergency_notes && (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>{t("no_allergies")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Family & Emergency Tab */}
        <TabsContent value="family" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("linked_parent")}
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
                        {currentStudent.custom_fields?.family?.parent_relation_type || t("relationship")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <InfoRow label={tFields("email")} value={linkedParent.profile?.email} icon={Mail} />
                    <InfoRow label={tFields("phone_number")} value={linkedParent.profile?.phone} icon={Phone} />
                    <InfoRow label={t("cnic")} value={linkedParent.cnic} />
                    <InfoRow label={tFields("occupation")} value={linkedParent.occupation} />
                    <InfoRow label={tFields("workplace")} value={linkedParent.workplace} />
                    <InfoRow label={tFields("address")} value={linkedParent.address} icon={MapPin} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>{t("no_parent")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {t("emergency_contacts")}
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
                          <p className="text-sm text-muted-foreground capitalize">{contact.relationship || t("contact_relationship")}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoRow label={t("contact_phone")} value={contact.phone} icon={Phone} />
                        {contact.address && <InfoRow label={tFields("address")} value={contact.address} icon={MapPin} />}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>{t("no_emergency_contacts")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discipline Score Tab */}
        {disciplineScoreActive && (
          <TabsContent value="discipline" className="mt-6">
            <DisciplineScoreTab
              studentId={currentStudent.id}
              campusId={campusContext?.selectedCampus?.id ?? null}
              academicYearId={currentStudent.custom_fields?.academic?.academic_year_id ?? null}
            />
          </TabsContent>
        )}

        {/* Relatives Tab */}
        {relativesActive && (
          <TabsContent value="relatives" className="mt-6">
            <RelativesTab studentId={currentStudent.id} />
          </TabsContent>
        )}

        {/* System Information Tab */}
        <TabsContent value="system" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("system_info")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label={t("student_id")} value={currentStudent.student_number} icon={Shield} />
                <InfoRow label={t("username")} value={currentStudent.custom_fields?.system?.username} />
                <InfoRow
                  label={t("account_status")}
                  value={
                    <Badge className={currentStudent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentStudent.profile?.is_active ? t("active") : t("inactive")}
                    </Badge>
                  }
                />
                <InfoRow
                  label={t("created_at")}
                  value={formatDate(currentStudent.created_at)}
                  icon={Clock}
                />
                <InfoRow
                  label={t("profile_id")}
                  value={<code className="text-xs bg-muted px-2 py-1 rounded">{currentStudent.profile_id}</code>}
                />
                <InfoRow
                  label={t("record_id")}
                  value={<code className="text-xs bg-muted px-2 py-1 rounded">{currentStudent.id}</code>}
                />
              </div>

              {currentStudent.custom_fields?.services?.selected_services &&
               currentStudent.custom_fields.services.selected_services.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4">{t("subscribed_services")}</h4>
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
