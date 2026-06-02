"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { AddStudentForm } from "@/components/admin";
import { useTranslations } from "next-intl";

export default function AddStudentPage() {
  const router = useRouter();
  const t = useTranslations("school.students.add_student");

  const handleSuccess = () => {
    router.push('/admin/students');
  };

  return (
    <div className="container mx-auto py-6">
      {/* Header with Back Button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-[#022172] hover:text-[#57A3CC]"
        >
          <ArrowLeft className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 rtl:rotate-180" />
          {t("back_to_students")}
        </Button>
        <h1 className="text-3xl font-bold text-[#022172] dark:text-white">{t("title")}</h1>
        <p className="text-gray-600 mt-2">{t("subtitle")}</p>
      </div>

      {/* Form Card */}
      <Card>
        <CardContent className="p-6">
          <AddStudentForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}
