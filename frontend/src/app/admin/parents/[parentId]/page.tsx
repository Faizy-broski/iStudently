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
  Users,
  Briefcase,
  Settings,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Clock,
  Building,
  CreditCard,
  FileText,
  GraduationCap,
  LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useProfileView } from "@/context/ProfileViewContext";
import { type Parent } from "@/lib/api/parents";
import { useParents } from "@/hooks/useParents";
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

export default function ParentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { setViewedProfile, clearViewedProfile } = useProfileView();
  
  // Get parent ID from URL
  const parentId = params.parentId as string;
  
  const [currentParent, setCurrentParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("personal");

  // Fetch all parents for navigation
  const { parents, total, loading: parentsLoading } = useParents({ page: 1, limit: 1000 });

  // Find current parent index for prev/next navigation
  const currentIndex = parents.findIndex((p) => p.id === parentId);
  const prevParent = currentIndex > 0 ? parents[currentIndex - 1] : null;
  const nextParent = currentIndex < parents.length - 1 ? parents[currentIndex + 1] : null;

  // Fetch parent details
  useEffect(() => {
    const fetchParent = async () => {
      setLoading(true);
      try {
        const parent = parents.find((p) => p.id === parentId);
        if (parent) {
          setCurrentParent(parent);
          
          // Update profile view context for sidebar indicator
          const parentFullName = `${parent.profile?.first_name || ""} ${parent.profile?.last_name || ""}`.trim() || "Parent";
          setViewedProfile({
            id: parent.id,
            name: parentFullName,
            type: 'parent',
            backUrl: '/admin/parents/parent-info'
          });
        }
      } catch (error) {
        console.error("Error fetching parent:", error);
        toast.error("Failed to load parent details");
      } finally {
        setLoading(false);
      }
    };

    if (parents.length > 0) {
      fetchParent();
    }
    
    // Clear profile view when leaving the page
    return () => {
      clearViewedProfile();
    };
  }, [parentId, parents, setViewedProfile, clearViewedProfile]);

  // Navigate to different parent
  const navigateToParent = (parent: Parent) => {
    router.push(`/admin/parents/${parent.id}`);
  };

  if (loading || parentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentParent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Parent Not Found</h2>
          <p className="text-muted-foreground mb-4">The parent you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Button onClick={() => router.push("/admin/parents/parent-info")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Parents
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${currentParent.profile?.first_name || ""} ${currentParent.profile?.last_name || ""}`.trim();

  return (
    <div className="p-6 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/parents/parent-info")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white">
              Parent Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Viewing {currentIndex + 1} of {total} parents
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevParent}
            onClick={() => prevParent && navigateToParent(prevParent)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextParent}
            onClick={() => nextParent && navigateToParent(nextParent)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            onClick={() => router.push(`/admin/parents/${currentParent.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Parent
          </Button>
        </div>
      </div>

      {/* Parent Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage
                src={currentParent.profile?.avatar_url || undefined}
                alt={fullName}
              />
              <AvatarFallback className="text-2xl bg-linear-to-r from-[#57A3CC] to-[#022172] text-white">
                {getInitials(currentParent.profile?.first_name, currentParent.profile?.last_name)}
              </AvatarFallback>
            </Avatar>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{fullName || "N/A"}</h2>
                  <p className="text-muted-foreground">
                    {currentParent.occupation || "No Occupation"} {currentParent.workplace ? `at ${currentParent.workplace}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className={currentParent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {currentParent.profile?.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {currentParent.children && currentParent.children.length > 0 && (
                    <Badge variant="outline">
                      {currentParent.children.length} {currentParent.children.length === 1 ? "Child" : "Children"}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Quick Contact Info */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {currentParent.profile?.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentParent.profile.email}
                  </span>
                )}
                {currentParent.profile?.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {currentParent.profile.phone}
                  </span>
                )}
                {currentParent.city && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {currentParent.city}
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
          <TabsTrigger value="work" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Work</span>
          </TabsTrigger>
          <TabsTrigger value="children" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Children</span>
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
                <InfoRow label="First Name" value={currentParent.profile?.first_name} />
                <InfoRow label="Last Name" value={currentParent.profile?.last_name} />
                <InfoRow label="Email" value={currentParent.profile?.email} icon={Mail} />
                <InfoRow label="Phone Number" value={currentParent.profile?.phone} icon={Phone} />
                <InfoRow label="CNIC / ID Number" value={currentParent.cnic} icon={CreditCard} />
              </div>
              
              <Separator className="my-6" />
              
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoRow label="Street Address" value={currentParent.address} icon={MapPin} />
                </div>
                <InfoRow label="City" value={currentParent.city} icon={Building} />
                <InfoRow label="State / Province" value={currentParent.state} />
                <InfoRow label="Zip / Postal Code" value={currentParent.zip_code} />
                <InfoRow label="Country" value={currentParent.country} />
              </div>

              {/* Emergency Contact */}
              {(currentParent.emergency_contact_name || currentParent.emergency_contact_phone) && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Emergency Contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InfoRow label="Contact Name" value={currentParent.emergency_contact_name} />
                    <InfoRow label="Relationship" value={currentParent.emergency_contact_relation} />
                    <InfoRow label="Phone" value={currentParent.emergency_contact_phone} icon={Phone} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Work Information Tab */}
        <TabsContent value="work" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Work Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoRow label="Occupation" value={currentParent.occupation} icon={Briefcase} />
                <InfoRow label="Workplace" value={currentParent.workplace} icon={Building} />
                <InfoRow label="Income" value={currentParent.income} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Children Tab */}
        <TabsContent value="children" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Linked Children
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentParent.children && currentParent.children.length > 0 ? (
                <div className="space-y-4">
                  {currentParent.children.map((child, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/admin/students/${encodeURIComponent(child.student_number)}`)}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white text-sm">
                            {getInitials(child.profile?.first_name, child.profile?.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {child.profile?.first_name || ""} {child.profile?.last_name || ""}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {child.student_number} • Grade {child.grade_level || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {child.relationship || "Related"}
                        </Badge>
                        {child.is_emergency_contact && (
                          <Badge variant="destructive" className="text-xs">
                            Emergency Contact
                          </Badge>
                        )}
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No children linked yet</p>
                  <p className="text-sm">Go to Associate Parent to link students</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => router.push('/admin/parents/associate-parent')}
                  >
                    Link Children
                  </Button>
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
                <InfoRow label="Parent ID" value={currentParent.id} />
                <InfoRow label="Profile ID" value={currentParent.profile_id} />
                <InfoRow label="School ID" value={currentParent.school_id} />
                <InfoRow 
                  label="Status" 
                  value={
                    <Badge className={currentParent.profile?.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {currentParent.profile?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  }
                />
                <InfoRow 
                  label="Created At" 
                  value={formatDate(currentParent.created_at)}
                  icon={Clock}
                />
                <InfoRow 
                  label="Last Updated" 
                  value={formatDate(currentParent.updated_at)}
                  icon={Clock}
                />
              </div>

              {/* Notes */}
              {currentParent.notes && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">
                    {currentParent.notes}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
