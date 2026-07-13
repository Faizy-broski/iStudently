"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardSchoolForm, { OnboardSuccessResult } from "@/components/forms/OnboardSchoolForm";
import AdminCredentialsCard from "@/components/super-admin/AdminCredentialsCard";
import { CopySchoolSettingsDialog, type CopySettingsSchoolOption } from "@/components/shared/CopySchoolSettingsDialog";
import { getAllSchoolsData } from "@/lib/api/schools";
import { toast } from "sonner";

export default function OnboardSchoolPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentialsResult, setCredentialsResult] = useState<OnboardSuccessResult | null>(null);
  const [newSchool, setNewSchool] = useState<{ id: string; name: string } | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [otherSchools, setOtherSchools] = useState<CopySettingsSchoolOption[]>([]);

  const handleSuccess = async (result: OnboardSuccessResult) => {
    toast.success(`School "${result.schoolName}" has been successfully onboarded!`);
    setCredentialsResult(result);
    setNewSchool({ id: result.schoolId, name: result.schoolName });
    const res = await getAllSchoolsData();
    if (res.success && res.data) setOtherSchools(res.data);
  };

  const closeCredentialsCard = () => {
    setCredentialsResult(null);
    setShowCopyDialog(true);
  };

  const finishOnboarding = () => {
    setShowCopyDialog(false);
    router.push("/superadmin/school-directory");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 py-8 px-4 transition-colors duration-300">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] dark:from-[#57A3CC] dark:to-white bg-clip-text text-transparent mb-2">
            Onboard New School
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create a new school and set up the admin credentials
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-2xl border-0 overflow-hidden dark:bg-gray-900">
          <div className="bg-gradient-to-r from-[#57A3CC] to-[#022172] h-2"></div>
          <CardHeader className="bg-white dark:bg-gray-900 pb-4">
            <CardTitle className="text-2xl text-[#022172] dark:text-white">School Onboarding Application</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Complete all required fields to onboard a new school
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-white dark:bg-gray-900 p-8">
            <OnboardSchoolForm 
              onSuccess={handleSuccess}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
            />
          </CardContent>
        </Card>
      </div>

      {credentialsResult && (
        <AdminCredentialsCard
          data={{
            schoolName: credentialsResult.schoolName,
            logoUrl: credentialsResult.logoUrl,
            adminName: credentialsResult.adminName,
            adminEmail: credentialsResult.adminEmail,
            username: credentialsResult.username,
            password: credentialsResult.password,
          }}
          onClose={closeCredentialsCard}
        />
      )}

      {newSchool && (
        <CopySchoolSettingsDialog
          targetSchoolId={newSchool.id}
          targetSchoolName={newSchool.name}
          sourceSchoolOptions={otherSchools}
          open={showCopyDialog}
          onOpenChange={(open) => { if (!open) finishOnboarding(); }}
          hideTrigger
        />
      )}
    </div>
  );
}
