"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { AddTeacherForm } from "@/components/admin/AddTeacherForm"

export default function AddTeacherPage() {
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
              Back to Teachers
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Add New Teacher
          </h1>
          <p className="text-muted-foreground">
            Create a new teacher profile with all required information
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#022172]">Teacher Registration Form</CardTitle>
          <CardDescription>
            Fill in all the details to create a new teacher account. Fields marked with * are required.
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
