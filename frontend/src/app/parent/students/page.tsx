'use client'

import { useState, useEffect } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { getStudentInfo, type StudentInfoData } from '@/lib/api/parent-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap, User, Calendar, Phone, Mail, MapPin,
  Droplets, Hash, School, Users,
} from 'lucide-react'

function formatDate(date?: string | null): string {
  if (!date) return '—'
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatGender(gender?: string | null): string {
  if (!gender) return '—'
  return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
}

function AgeDisplay({ age }: { age: StudentInfoData['age'] }) {
  if (!age) return <span className="text-muted-foreground">—</span>
  const parts = []
  if (age.years > 0) parts.push(`${age.years} yr${age.years !== 1 ? 's' : ''}`)
  if (age.months > 0) parts.push(`${age.months} mo`)
  if (age.days > 0) parts.push(`${age.days} day${age.days !== 1 ? 's' : ''}`)
  return <span>{parts.join(', ') || '< 1 day'}</span>
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 py-2 border-b last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-center">
        {label}
      </span>
      <span className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ParentStudentsPage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const [info, setInfo] = useState<StudentInfoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedStudentData?.id) {
      setInfo(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getStudentInfo(selectedStudentData.id)
      .then(data => setInfo(data))
      .catch(err => setError(err.message || 'Failed to load student info'))
      .finally(() => setLoading(false))
  }, [selectedStudentData?.id])

  if (studentsLoading || loading) return <LoadingSkeleton />

  if (!selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view their information.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{error || 'Student information not available.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fullName = `${info.first_name} ${info.last_name}`.trim()
  const initials = `${info.first_name?.[0] || ''}${info.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Student Info
        </h1>
        <p className="text-muted-foreground text-sm">
          {fullName}
          {info.student_number && (
            <> &mdash; <span className="font-medium text-[#022172] dark:text-blue-400">{info.student_number}</span></>
          )}
        </p>
      </div>

      {/* Student identity banner */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 text-xl shrink-0">
              <AvatarImage src={info.profile_photo_url ?? undefined} alt={fullName} />
              <AvatarFallback className="bg-[#57A3CC] text-white text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1 min-w-0">
              <h2 className="text-xl font-bold text-[#022172] dark:text-white truncate">{fullName}</h2>
              <div className="flex flex-wrap gap-2">
                {info.grade_level && (
                  <Badge variant="secondary" className="text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {info.grade_level}
                  </Badge>
                )}
                {info.section_name && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {info.section_name}
                  </Badge>
                )}
                {info.campus_name && (
                  <Badge variant="outline" className="text-xs">
                    <School className="h-3 w-3 mr-1" />
                    {info.campus_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed detail sections */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="contacts">Addresses &amp; Contacts</TabsTrigger>
        </TabsList>

        {/* ── General Info ── */}
        <TabsContent value="general" className="mt-5">
          <Card>
            <CardContent className="p-5 divide-y">
              <InfoRow
                label="Student Number"
                value={
                  <span className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    {info.student_number || '—'}
                  </span>
                }
              />
              <InfoRow label="First Name" value={info.first_name || '—'} />
              <InfoRow label="Last Name" value={info.last_name || '—'} />
              <InfoRow label="Father's Name" value={info.father_name || '—'} />
              <InfoRow label="Grandfather's Name" value={info.grandfather_name || '—'} />
              <InfoRow label="Gender" value={formatGender(info.gender)} />
              <InfoRow
                label="Birthdate"
                value={
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatDate(info.date_of_birth)}
                  </span>
                }
              />
              <InfoRow
                label="Age"
                value={<AgeDisplay age={info.age} />}
              />
              <InfoRow label="Grade Level" value={info.grade_level || '—'} />
              <InfoRow label="Section / Calendar" value={info.section_name || '—'} />
              <InfoRow
                label="Admission Date"
                value={formatDate(info.admission_date)}
              />
              {info.blood_group && (
                <InfoRow
                  label="Blood Group"
                  value={
                    <span className="flex items-center gap-2">
                      <Droplets className="h-3.5 w-3.5 text-red-500" />
                      {info.blood_group}
                    </span>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* Enrollment History */}
          {info.enrollments.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Enrollment History
              </h3>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Academic Year</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">School</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Start Date</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">End Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {info.enrollments.map(enr => (
                        <tr key={enr.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{enr.academic_year || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{enr.school_name || '—'}</td>
                          <td className="px-4 py-2.5">{formatDate(enr.start_date)}</td>
                          <td className="px-4 py-2.5">{enr.end_date ? formatDate(enr.end_date) : <Badge variant="outline" className="text-xs text-green-600 border-green-300">Active</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Addresses & Contacts ── */}
        <TabsContent value="contacts" className="mt-5">
          <Card>
            <CardContent className="p-5 divide-y">
              <InfoRow
                label="Address"
                value={
                  info.address ? (
                    <span className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="whitespace-pre-line">{info.address}</span>
                    </span>
                  ) : '—'
                }
              />
              <InfoRow
                label="Email"
                value={
                  info.email ? (
                    <span className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`mailto:${info.email}`} className="text-blue-600 hover:underline">{info.email}</a>
                    </span>
                  ) : '—'
                }
              />
              <InfoRow
                label="Phone"
                value={
                  info.phone ? (
                    <span className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={`tel:${info.phone}`} className="text-blue-600 hover:underline">{info.phone}</a>
                    </span>
                  ) : '—'
                }
              />
              <InfoRow label="Father's Name" value={info.father_name || '—'} />
              <InfoRow label="Grandfather's Name" value={info.grandfather_name || '—'} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
