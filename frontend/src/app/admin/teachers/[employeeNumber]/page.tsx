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
  BarChart3,
  TrendingDown,
  TrendingUp,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useProfileView } from "@/context/ProfileViewContext";
import { QualificationsTab } from "@/components/admin/QualificationsTab";
import { UserQRCode } from "@/components/shared/UserQRCode";
import { type Staff } from "@/lib/api/teachers";
import { useTeachers } from "@/hooks/useTeachers";
import { getLastLogin } from "@/lib/api/auth";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { getStaffScore, getLogs, type PerformanceScore, type StaffPerformanceLog } from "@/lib/api/performance";

// Helper to format dates
const formatDate = (dateString: string | null | undefined, notProvidedLabel: string) => {
  if (!dateString) return notProvidedLabel;
  try {
    return format(new Date(dateString), "MMMM d, yyyy");
  } catch {
    return dateString;
  }
};

// Helper to format date + time
const formatDateTime = (dateString: string | null | undefined, notProvidedLabel: string) => {
  if (!dateString) return notProvidedLabel;
  try {
    return format(new Date(dateString), "MMMM d, yyyy h:mm a");
  } catch {
    return dateString;
  }
};

// Helper to get initials
const getInitials = (firstName?: string | null, lastName?: string | null) => {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "NA";
};

// Helper to format currency
const formatCurrency = (amount: number | null | undefined, notSetLabel: string) => {
  if (!amount) return notSetLabel;
  return amount.toLocaleString();
};

// Info Row Component
const InfoRow = ({ label, value, icon: Icon, fallbackLabel }: { label: string; value: React.ReactNode; icon?: LucideIcon; fallbackLabel: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-muted-foreground flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </span>
    <span className="font-medium">{value || <span className="text-muted-foreground italic">{fallbackLabel}</span>}</span>
  </div>
);

export default function TeacherDetailsPage() {
  const t = useTranslations("teachers");
  const params = useParams();
  const router = useRouter();
  const { setViewedProfile, clearViewedProfile } = useProfileView();

  // Get employee number from URL (URL-encoded, so decode it)
  const employeeNumber = decodeURIComponent(params.employeeNumber as string);

  const [currentTeacher, setCurrentTeacher] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [perfScore, setPerfScore] = useState<PerformanceScore | null>(null);
  const [perfLogs,  setPerfLogs]  = useState<StaffPerformanceLog[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);

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

          if (teacher.profile_id) {
            getLastLogin(teacher.profile_id).then((res) => {
              if (res.success && res.data) setLastLogin(res.data.last_sign_in);
            }).catch(() => {});
          }

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
        toast.error(t("errors.loadTeacherDetails"));
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

  // Fetch performance data when Performance tab is active
  useEffect(() => {
    if (activeTab !== "performance" || !currentTeacher?.id) return;
    setPerfLoading(true);
    Promise.all([
      getStaffScore(currentTeacher.id),
      getLogs({ staffId: currentTeacher.id, limit: 50 }),
    ]).then(([score, logsResult]) => {
      setPerfScore(score);
      setPerfLogs(logsResult.data);
    }).catch(() => {}).finally(() => setPerfLoading(false));
  }, [activeTab, currentTeacher?.id]);

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
          <h2 className="text-xl font-semibold mb-2">{t("notFound")}</h2>
          <p className="text-muted-foreground mb-4">{t("notFoundDesc")}</p>
          <Button onClick={() => router.push("/admin/teachers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("backToTeachers")}
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${currentTeacher.profile?.first_name || ""} ${currentTeacher.profile?.last_name || ""}`.trim();

  // Format employment type
  const formatEmploymentType = (type: string | null | undefined) => {
    if (!type) return t("na");
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
              {t("teacherDetails")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("viewingTeacherCount", { current: currentIndex + 1, total })}
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
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextTeacher}
            onClick={() => nextTeacher && navigateToTeacher(nextTeacher)}
          >
            {t("next")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            onClick={() => router.push(`/admin/teachers/${encodeURIComponent(currentTeacher.employee_number)}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {t("actions.editTeacher")}
          </Button>
        </div>
      </div>

      {/* Teacher Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
           <div className="h-32 w-24 rounded-xl border-4 border-white shadow-lg overflow-hidden shrink-0 bg-linear-to-b from-[#57A3CC] to-[#022172] flex items-center justify-center">
  {currentTeacher.profile?.profile_photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentTeacher.profile.profile_photo_url}
      alt={fullName}
      className="h-full w-full object-cover object-top"
    />
  ) : (
    <span className="text-2xl font-bold text-white">
      {getInitials(currentTeacher.profile?.first_name, currentTeacher.profile?.last_name)}
    </span>
  )}
</div>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || t("na")}</h2>
                  <p className="text-muted-foreground">
                    {currentTeacher.employee_number} • {currentTeacher.department || t("noDepartment")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentTeacher.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentTeacher.is_active ? t("active") : t("inactive")}
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

            {currentTeacher.profile_id && (
              <div className="shrink-0">
                <UserQRCode value={currentTeacher.profile_id} size={100} label={fullName || currentTeacher.employee_number} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.personal")}</span>
          </TabsTrigger>
          <TabsTrigger value="professional" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.professional")}</span>
          </TabsTrigger>
          <TabsTrigger value="subjects" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.subjects")}</span>
          </TabsTrigger>
          <TabsTrigger value="qualifications" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.qualifications")}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t("tabs.system")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("personalInformation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label={t("fields.firstName")} value={currentTeacher.profile?.first_name} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.lastName")} value={currentTeacher.profile?.last_name} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.email")} value={currentTeacher.profile?.email} icon={Mail} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.phoneNumber")} value={currentTeacher.profile?.phone} icon={Phone} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.username")} value={currentTeacher.profile?.username} icon={User} fallbackLabel={t("notProvided")} />
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
                {t("professionalInformation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label={t("fields.employeeNumber")} value={currentTeacher.employee_number} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.title")} value={currentTeacher.title} icon={Briefcase} fallbackLabel={t("notProvided")} />
                <InfoRow label={t("fields.department")} value={currentTeacher.department} icon={Building} fallbackLabel={t("notProvided")} />
                <InfoRow
                  label={t("fields.employmentType")}
                  value={
                    <Badge variant="outline" className="capitalize">
                      {formatEmploymentType(currentTeacher.employment_type)}
                    </Badge>
                  }
                  fallbackLabel={t("notProvided")}
                />
                <InfoRow
                  label={t("fields.dateOfJoining")}
                  value={formatDate(currentTeacher.date_of_joining, t("notProvided"))}
                  icon={Calendar}
                  fallbackLabel={t("notProvided")}
                />
                <InfoRow
                  label={t("fields.baseSalary")}
                  value={formatCurrency(currentTeacher.base_salary, t("notSet"))}
                  icon={DollarSign}
                  fallbackLabel={t("notProvided")}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label={t("fields.qualifications")} value={currentTeacher.qualifications} icon={GraduationCap} fallbackLabel={t("notProvided")} />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label={t("fields.specialization")} value={currentTeacher.specialization} fallbackLabel={t("notProvided")} />
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
                {t("assignedSubjectsSections")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentTeacher.assigned_subjects && currentTeacher.assigned_subjects.length > 0 ? (
                <div className="space-y-4">
                  {currentTeacher.assigned_subjects.map((assignment, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{assignment.subject?.name || t("unknownSubject")}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.section?.name || t("unknownSection")} • {typeof assignment.section?.grade_level === 'object' ? assignment.section?.grade_level?.name : assignment.section?.grade_level || t("na")}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {assignment.is_primary ? t("primaryTeacher") : t("subjectTeacher")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t("noSubjectsAssigned")}</p>
                  <p className="text-sm">{t("goToWorkload")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualifications Tab */}
        <TabsContent value="qualifications" className="mt-6">
          {currentTeacher.profile_id ? (
            <QualificationsTab profileId={currentTeacher.profile_id} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("profileIdNotAvailable")}
            </p>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-6">
          {perfLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {perfScore && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="flex flex-col items-center justify-center py-6 col-span-1">
                    <CardContent className="flex flex-col items-center gap-3">
                      <div className="relative h-28 w-28">
                        <svg viewBox="0 0 100 100" className="-rotate-90">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                          <circle
                            cx="50" cy="50" r="40" fill="none"
                            stroke={perfScore.score >= 80 ? "#16a34a" : perfScore.score >= 60 ? "#d97706" : "#dc2626"}
                            strokeWidth="12"
                            strokeDasharray={`${(perfScore.score / 100) * 251.2} 251.2`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold">{perfScore.score}</span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${perfScore.score >= 80 ? "text-green-600" : perfScore.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {perfScore.score >= 80 ? "Excellent" : perfScore.score >= 60 ? "Good" : "Needs Improvement"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-muted-foreground">Total Demerit</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">-{perfScore.total_demerit}</p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Total Redemption</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">+{perfScore.total_redemption}</p>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Total Incidents</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{perfScore.log_count}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Incident Log</CardTitle>
                    <button
                      className="text-sm text-[#022172] hover:underline"
                      onClick={() => router.push(`/admin/performance?staff=${currentTeacher?.id}`)}
                    >
                      View all →
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">Date</th>
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">Action</th>
                        <th className="text-center px-4 py-2 text-muted-foreground font-medium">Type</th>
                        <th className="text-center px-4 py-2 text-muted-foreground font-medium">Pts</th>
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium">Notes</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {perfLogs.map(log => {
                        const pts = log.custom_points ?? log.action?.default_points ?? 0;
                        const isDemerit = log.action?.action_type === "violation_demerit";
                        return (
                          <tr key={log.id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                              {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                            </td>
                            <td className="px-4 py-2">
                              <p className="font-medium">{log.action?.action_name_en}</p>
                              <p className="text-xs text-muted-foreground" dir="rtl">{log.action?.action_name_ar}</p>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isDemerit ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                {isDemerit ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                {isDemerit ? "Violation" : "Reward"}
                              </span>
                            </td>
                            <td className={`px-4 py-2 text-center font-semibold ${isDemerit ? "text-red-600" : "text-green-600"}`}>
                              {isDemerit ? pts : `+${pts}`}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">
                              {log.notes || "—"}
                            </td>
                            <td className="px-4 py-2">
                              {log.letter_generated && (
                                <FileText className="h-4 w-4 text-orange-500" title="Disciplinary letter" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {perfLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-muted-foreground">
                            No incidents recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* System Information Tab */}
        <TabsContent value="system" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("systemInformation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow
                  label={t("fields.status")}
                  value={
                    <Badge className={currentTeacher.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentTeacher.is_active ? t("active") : t("inactive")}
                    </Badge>
                  }
                  fallbackLabel={t("notProvided")}
                />
                <InfoRow
                  label={t("fields.createdAt")}
                  value={formatDate(currentTeacher.created_at, t("notProvided"))}
                  icon={Clock}
                  fallbackLabel={t("notProvided")}
                />
                <InfoRow
                  label={t("fields.lastUpdated")}
                  value={formatDate(currentTeacher.updated_at, t("notProvided"))}
                  icon={Clock}
                  fallbackLabel={t("notProvided")}
                />
                <InfoRow
                  label={t("fields.lastLogin")}
                  value={lastLogin ? formatDateTime(lastLogin, t("notProvided")) : t("never")}
                  icon={Clock}
                  fallbackLabel={t("notProvided")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
