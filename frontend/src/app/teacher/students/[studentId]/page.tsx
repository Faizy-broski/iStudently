'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, GraduationCap, MapPin, Phone, Mail, User } from 'lucide-react'
import { getStudentsForGrades, type StudentListItem } from '@/lib/api/grades'

export default function TeacherStudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const studentId = params.studentId as string
  const campusId = profile?.campus_id

  const { data: students, isLoading } = useSWR<StudentListItem[]>(
    studentId ? ['teacher-student-detail', studentId, campusId] : null,
    async () => {
      const res = await getStudentsForGrades({ campus_id: campusId || undefined, limit: 500 })
      return res.data ?? []
    },
    { revalidateOnFocus: false }
  )

  const student = students?.find(s => s.id === studentId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold text-lg mb-1">Student not found</h3>
          <p className="text-muted-foreground text-sm">This student may not be in your sections.</p>
        </Card>
      </div>
    )
  }

  const name = [student.profile?.first_name, student.profile?.last_name].filter(Boolean).join(' ') || 'Unknown'
  const initials = [student.profile?.first_name?.[0], student.profile?.last_name?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?'

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Students
      </Button>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl text-brand-blue dark:text-white">{name}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                {student.grade_level && (
                  <Badge variant="secondary" className="gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {student.grade_level}
                  </Badge>
                )}
                <Badge variant={student.is_active ? 'default' : 'destructive'}>
                  {student.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">ID: {student.student_number}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {student.profile?.email && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <a href={`mailto:${student.profile.email}`} className="text-sm font-medium hover:underline text-blue-600">
                    {student.profile.email}
                  </a>
                </div>
              </div>
            )}
            {student.profile?.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <Phone className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                  <a href={`tel:${student.profile.phone}`} className="text-sm font-medium hover:underline">
                    {student.profile.phone}
                  </a>
                </div>
              </div>
            )}
            {student.profile?.father_name && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <User className="h-4 w-4 text-purple-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Father's Name</p>
                  <p className="text-sm font-medium">{student.profile.father_name}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
