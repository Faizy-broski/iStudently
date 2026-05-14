'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useParentStudents } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, GraduationCap, MapPin, Phone, Mail, User } from 'lucide-react'

export default function ParentStudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.studentId as string

  const { students, isLoading } = useParentStudents()
  const student = students?.find(s => s.id === studentId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Student not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Button>

      {/* Profile card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={student.profile_photo_url} />
              <AvatarFallback className="bg-[#57A3CC] text-white text-xl">
                {student.first_name?.[0]}{student.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {student.first_name} {student.last_name}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className="gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {student.grade_level} — {student.section}
                </Badge>
                {student.campus_name && (
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3 w-3" />
                    {student.campus_name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">ID: {student.student_number}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {student.email && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Email</p>
                  <a href={`mailto:${student.email}`} className="text-sm font-medium hover:underline text-blue-600">{student.email}</a>
                </div>
              </div>
            )}
            {student.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                <Phone className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                  <a href={`tel:${student.phone}`} className="text-sm font-medium hover:underline">{student.phone}</a>
                </div>
              </div>
            )}
            {(student as any).father_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                <User className="h-4 w-4 text-purple-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Father's Name</p>
                  <p className="text-sm font-medium">{(student as any).father_name}</p>
                </div>
              </div>
            )}
            {(student as any).date_of_birth && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                <User className="h-4 w-4 text-orange-600 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Date of Birth</p>
                  <p className="text-sm font-medium">{new Date((student as any).date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
