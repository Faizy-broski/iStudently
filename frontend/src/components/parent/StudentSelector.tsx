'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function StudentSelector() {
  const { students, selectedStudent, setSelectedStudent, isLoading } = useParentDashboard()

  if (isLoading) {
    return (
      <div className="animate-pulse h-10 w-64 bg-gray-200 rounded-md" />
    )
  }

  if (students.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No students found
      </div>
    )
  }

  // Find the selected student object
  const currentStudent = students.find(s => s.id === selectedStudent)

  return (
    <Select
      value={selectedStudent || ''}
      onValueChange={(value) => {
        setSelectedStudent(value)
      }}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a child">
          {currentStudent && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={currentStudent.profile_photo_url} />
                <AvatarFallback>
                  {currentStudent.first_name[0]}{currentStudent.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {currentStudent.first_name} {currentStudent.last_name}
                </span>
                <span className="text-xs text-gray-500">
                  {currentStudent.grade_level} - {currentStudent.section}
                </span>
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {students.map((student) => (
          <SelectItem key={student.id} value={student.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={student.profile_photo_url} />
                <AvatarFallback>
                  {student.first_name[0]}{student.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">
                  {student.first_name} {student.last_name}
                </span>
                <span className="text-xs text-gray-500">
                  {student.grade_level} - {student.section} • {student.campus_name}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
