"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { AddTeacherForm } from "@/components/admin/AddTeacherForm"
import * as teachersApi from "@/lib/api/teachers"
import { toast } from "sonner"
import { useCampus } from "@/context/CampusContext"

export default function EditTeacherPage() {
  const params = useParams()
  const router = useRouter()
  const campusContext = useCampus()
  const employeeNumber = decodeURIComponent(params.employeeNumber as string)
  
  const [teacher, setTeacher] = useState<teachersApi.Staff | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        // First get all teachers to find the one with matching employee number
        // Use campus filter to match the list page behavior
        const result = await teachersApi.getAllTeachers({ 
          page: 1, 
          limit: 1000,
          campus_id: campusContext?.selectedCampus?.id 
        })
        const foundTeacher = result.data?.find(t => t.employee_number === employeeNumber)
        
        if (foundTeacher) {
          // Fetch full details including base_salary
          const fullTeacher = await teachersApi.getTeacherById(foundTeacher.id)
          if (fullTeacher) {
            setTeacher(fullTeacher)
          } else {
            toast.error("Failed to load teacher details")
            router.push('/admin/teachers')
          }
        } else {
          toast.error("Teacher not found")
          router.push('/admin/teachers')
        }
      } catch (error) {
        console.error("Error fetching teacher:", error)
        toast.error("Failed to load teacher")
        router.push('/admin/teachers')
      } finally {
        setLoading(false)
      }
    }

    fetchTeacher()
  }, [employeeNumber, router, campusContext?.selectedCampus?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!teacher) {
    return null
  }

  const teacherName = `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`.trim() || teacher.employee_number

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/teachers/${encodeURIComponent(employeeNumber)}`)}
              className="text-[#022172] hover:text-[#022172]/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Teacher Details
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Edit Teacher
          </h1>
          <p className="text-muted-foreground">
            Update information for {teacherName}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#022172]">Edit Teacher Information</CardTitle>
          <CardDescription>
            Update the teacher&apos;s details. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddTeacherForm 
            onSuccess={() => {
              router.push(`/admin/teachers/${encodeURIComponent(employeeNumber)}`)
            }}
            editingTeacher={teacher}
          />
        </CardContent>
      </Card>
    </div>
  )
}
