'use client'

import { useState } from 'react'
import { useStudentInfo } from '@/hooks/useStudentDashboard'
import { User, MapPin, Phone, Mail, Calendar, Hash, School, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

type Tab = 'general' | 'contacts'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wide sm:w-48 shrink-0">{label}</span>
      <span className="font-medium text-sm">{value || '—'}</span>
    </div>
  )
}

export default function StudentInfoPage() {
  const { studentInfo: s, isLoading, error } = useStudentInfo()
  const [tab, setTab] = useState<Tab>('general')

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-6 flex items-center gap-4">
          <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading student info</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  if (!s) return null

  const fullName = [s.first_name, s.father_name, s.grandfather_name, s.last_name].filter(Boolean).join(' ')

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {s.profile_photo_url
            ? <img src={s.profile_photo_url} alt={fullName} className="h-14 w-14 rounded-full object-cover" />
            : <User className="h-7 w-7 text-primary" />
          }
        </div>
        <div>
          <h1 className="text-2xl font-bold">{fullName || '—'}</h1>
          <p className="text-muted-foreground text-sm">{s.school_name}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b">
        {(['general', 'contacts'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-semibold uppercase tracking-wide border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'general' ? 'General Info' : 'Addresses & Contacts'}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-6">
          {/* Identity block */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                <div>
                  <InfoRow label="Name" value={fullName} />
                  <InfoRow label="Student Number" value={s.student_number} />
                  <InfoRow label="Admission Date" value={s.admission_date ? format(parseISO(s.admission_date), 'MMMM dd yyyy') : null} />
                </div>
                <div>
                  <InfoRow label="Grade Level" value={s.grade_level_name || s.grade_level} />
                  <InfoRow label="Section / Class" value={s.section_name} />
                  <InfoRow label="School" value={s.school_name} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demographics block */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                <div>
                  <InfoRow label="Gender" value={s.gender} />
                  <InfoRow
                    label="Birthdate"
                    value={s.date_of_birth ? format(parseISO(s.date_of_birth), 'MMMM dd yyyy') : null}
                  />
                  <InfoRow label="Age" value={s.age} />
                </div>
                <div>
                  <InfoRow label="First Name" value={s.first_name} />
                  <InfoRow label="Father's Name" value={s.father_name} />
                  <InfoRow label="Grandfather's Name" value={s.grandfather_name} />
                  <InfoRow label="Last Name" value={s.last_name} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrollment record */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">1 enrollment record was found.</p>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr className="text-xs text-primary uppercase font-semibold tracking-wide">
                      <th className="text-left px-4 py-3">Attendance Start Date This School Year</th>
                      <th className="text-left px-4 py-3">Dropped</th>
                      <th className="text-left px-4 py-3">School</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3">
                        {s.admission_date ? format(parseISO(s.admission_date), 'MMMM dd yyyy') + ' - Beginning of Year' : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">- - N/A</td>
                      <td className="px-4 py-3">{s.school_name || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-0">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Contact Information
              </h3>
              <InfoRow label="Email Address" value={s.email} />
              <InfoRow label="Phone Number" value={s.phone} />
            </CardContent>
          </Card>

          {s.address && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Address
                </h3>
                <p className="text-sm">{s.address}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-6 space-y-0">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                <School className="h-4 w-4" /> School Contact
              </h3>
              <InfoRow label="School Name" value={s.school_name} />
              <InfoRow label="School Address" value={s.school_address} />
              <InfoRow label="School Phone" value={s.school_phone} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
