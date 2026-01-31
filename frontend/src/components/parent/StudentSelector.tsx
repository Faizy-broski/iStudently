'use client'

import { useMemo } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, GraduationCap } from 'lucide-react'

export function StudentSelector() {
  const { students, selectedStudent, selectedStudentData, setSelectedStudent, isLoading } = useParentDashboard()

  // Group students by campus for better UX when parent has children in multiple campuses
  const groupedStudents = useMemo(() => {
    const groups: Record<string, typeof students> = {}
    
    for (const student of students) {
      const campusName = student.campus_name || 'Main Campus'
      if (!groups[campusName]) {
        groups[campusName] = []
      }
      groups[campusName].push(student)
    }
    
    return groups
  }, [students])

  const campusNames = Object.keys(groupedStudents)
  const hasMultipleCampuses = campusNames.length > 1

  if (isLoading) {
    return <Skeleton className="h-12 w-72" />
  }

  if (students.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
        <GraduationCap className="h-4 w-4" />
        No students linked
      </div>
    )
  }

  return (
    <Select
      value={selectedStudent || ''}
      onValueChange={(value) => setSelectedStudent(value)}
    >
      <SelectTrigger className="w-72 h-auto py-2">
        <SelectValue placeholder="Select a child">
          {selectedStudentData && (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarImage src={selectedStudentData.profile_photo_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedStudentData.first_name?.[0]}{selectedStudentData.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-semibold">
                  {selectedStudentData.first_name} {selectedStudentData.last_name}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{selectedStudentData.grade_level}</span>
                  {selectedStudentData.section && (
                    <>
                      <span>•</span>
                      <span>{selectedStudentData.section}</span>
                    </>
                  )}
                  {hasMultipleCampuses && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="h-4 text-[10px] px-1">
                        {selectedStudentData.campus_name}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-72">
        {hasMultipleCampuses ? (
          // Grouped by campus when multiple campuses
          campusNames.map((campusName) => (
            <SelectGroup key={campusName}>
              <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground py-2">
                <Building2 className="h-3.5 w-3.5" />
                {campusName}
              </SelectLabel>
              {groupedStudents[campusName].map((student) => (
                <SelectItem 
                  key={student.id} 
                  value={student.id}
                  className="py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={student.profile_photo_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {student.first_name?.[0]}{student.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{student.grade_level}</span>
                        {student.section && (
                          <>
                            <span>•</span>
                            <span>Section {student.section}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-primary/70">#{student.student_number}</span>
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))
        ) : (
          // Flat list when single campus
          students.map((student) => (
            <SelectItem 
              key={student.id} 
              value={student.id}
              className="py-2"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={student.profile_photo_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {student.first_name?.[0]}{student.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {student.first_name} {student.last_name}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{student.grade_level}</span>
                    {student.section && (
                      <>
                        <span>•</span>
                        <span>Section {student.section}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-primary/70">#{student.student_number}</span>
                  </div>
                </div>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
