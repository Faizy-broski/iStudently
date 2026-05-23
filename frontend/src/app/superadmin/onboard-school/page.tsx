"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardSchoolForm from "@/components/forms/OnboardSchoolForm";
import { toast } from "sonner";

export default function OnboardSchoolPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSuccess = (schoolName: string) => {
    toast.success(`School "${schoolName}" has been successfully onboarded!`);
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
    </div>
  );
}
