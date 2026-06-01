'use client'

import { useState } from 'react'
import { useStudentClassPictures } from '@/hooks/useStudentDashboard'
import { Camera, Loader2, AlertCircle, User, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

function PhotoCard({ name, photoUrl, isSelf, role }: {
  name: string
  photoUrl: string | null
  isSelf?: boolean
  role?: 'teacher' | 'student'
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-20 h-24 rounded border flex items-center justify-center overflow-hidden bg-muted shrink-0 ${isSelf ? 'ring-2 ring-primary' : ''}`}>
        {photoUrl
          ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
          : <User className="h-8 w-8 text-muted-foreground" />
        }
      </div>
      {role === 'teacher' && <span className="text-[10px] font-bold text-amber-600 uppercase">Teacher</span>}
      <span className="text-xs text-center leading-tight font-medium max-w-20 wrap-break-word">{name}</span>
    </div>
  )
}

export default function StudentClassPicturesPage() {
  const { classPictures, isLoading, error } = useStudentClassPictures()
  const [selectedCpId, setSelectedCpId] = useState<string>('all')
  const [includeTeacher, setIncludeTeacher] = useState(true)

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
            <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading class pictures</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const cps = classPictures?.course_periods || []
  const students = classPictures?.students || []

  // Find the selected course period's teacher
  const selectedCp = selectedCpId !== 'all' ? cps.find(cp => cp.id === selectedCpId) : null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Class Pictures</h1>
          <p className="text-muted-foreground mt-1">Class photo roster for your section</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Options */}
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Select value={selectedCpId} onValueChange={setSelectedCpId}>
            <SelectTrigger className="w-55"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Course Periods</SelectItem>
              {cps.map(cp => (
                <SelectItem key={cp.id} value={cp.id}>{cp.title || cp.course_title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeTeacher}
            onChange={e => setIncludeTeacher(e.target.checked)}
            className="w-4 h-4"
          />
          Include Teacher
        </label>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-lg mb-2">No classmates found</p>
            <p className="text-muted-foreground text-sm">You may not be assigned to a section yet.</p>
          </CardContent>
        </Card>
      ) : selectedCpId === 'all' ? (
        // Show all course periods
        <div className="space-y-6">
          {cps.map(cp => (
            <Card key={cp.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Camera className="h-5 w-5" />
                  {cp.title || cp.course_title}
                  {cp.teacher_name && <Badge variant="outline" className="text-xs font-normal">{cp.teacher_name}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {includeTeacher && cp.teacher_name && (
                    <PhotoCard
                      name={cp.teacher_name}
                      photoUrl={cp.teacher_photo_url}
                      role="teacher"
                    />
                  )}
                  {students.map(s => (
                    <PhotoCard
                      key={s.id}
                      name={s.name}
                      photoUrl={s.photo_url}
                      isSelf={s.is_self}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {students.length} student{students.length !== 1 ? 's' : ''}
                  {includeTeacher && cp.teacher_name ? ' + teacher' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Show selected course period
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5" />
              {selectedCp?.title || selectedCp?.course_title}
              {selectedCp?.teacher_name && (
                <Badge variant="outline" className="text-xs font-normal">{selectedCp.teacher_name}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {includeTeacher && selectedCp?.teacher_name && (
                <PhotoCard
                  name={selectedCp.teacher_name}
                  photoUrl={selectedCp.teacher_photo_url || null}
                  role="teacher"
                />
              )}
              {students.map(s => (
                <PhotoCard
                  key={s.id}
                  name={s.name}
                  photoUrl={s.photo_url}
                  isSelf={s.is_self}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {students.length} student{students.length !== 1 ? 's' : ''}
              {includeTeacher && selectedCp?.teacher_name ? ' + teacher' : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
