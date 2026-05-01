"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { AddTeacherForm } from "@/components/admin/AddTeacherForm"
import { useTranslations } from "next-intl"

export default function AddTeacherPage() {
  const t = useTranslations("teachers")
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/teachers')}
              className="text-[#022172] hover:text-[#022172]/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("backToTeachers")}
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            {t("addNewTeacherTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("addNewTeacherSubtitle")}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#022172]">{t("teacherRegistrationForm")}</CardTitle>
          <CardDescription>
            {t("teacherRegistrationDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddTeacherForm 
            onSuccess={() => {
              router.push('/admin/teachers')
            }}
            editingTeacher={null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
