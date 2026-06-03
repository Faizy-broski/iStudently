"use client"

import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, BookOpen, Users, Clock, FileText, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import * as teachersApi from '@/lib/api/teachers'
import { TeacherSubjectAssignment } from '@/types'

const fetcher = async (url: string) => {
  const [, teacherId] = url.split('|')
  return await teachersApi.getTeacherAssignments()
}

export default function SubjectsPage() {
  const { profile } = useAuth()
  
  const { data: assignments, isLoading, error } = useSWR<TeacherSubjectAssignment[]>(
    profile?.staff_id ? `teacher-assignments|${profile.staff_id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (error) {
    toast.error(error.message || 'Failed to load subjects')
  }

  // Group assignments by subject
  const groupedBySubject = (assignments || []).reduce((acc, assignment) => {
    const subjectId = assignment.subject_id
    if (!acc[subjectId]) {
      acc[subjectId] = {
        subject: assignment.subject,
        sections: []
      }
    }
    acc[subjectId].sections.push(assignment)
    return acc
  }, {} as Record<string, { subject: any, sections: TeacherSubjectAssignment[] }>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">My Subjects</h1>
        <p className="text-muted-foreground mt-1">
          Subjects you teach across different sections
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Subjects</p>
              <p className="text-2xl font-bold">{Object.keys(groupedBySubject).length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-100">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sections</p>
              <p className="text-2xl font-bold">{(assignments || []).length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Assignments</p>
              <p className="text-2xl font-bold">{(assignments || []).filter(a => a.is_primary).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Subjects List */}
      {Object.keys(groupedBySubject).length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Subjects Assigned</h3>
          <p className="text-muted-foreground">
            You haven't been assigned to teach any subjects yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedBySubject).map(([subjectId, { subject, sections }]) => (
            <Card key={subjectId} className="overflow-hidden">
              {/* Subject Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {subject?.name || 'Unknown Subject'}
                    </h2>
                    {subject?.code && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Code: {subject.code}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      Syllabus
                    </Button>
                    <Button variant="outline" size="sm">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Resources
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Teaching Sections ({sections.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sections.map((assignment) => (
                    <Card 
                      key={assignment.id} 
                      className="p-4 hover:shadow-md transition-shadow border-2"
                      style={{
                        borderColor: assignment.is_primary ? '#3b82f6' : '#e5e7eb'
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">
                            {assignment.section?.name || 'Unknown Section'}
                          </h4>
                          {assignment.is_primary && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {assignment.section?.grade_level?.name || 'Unknown Grade'}
                        </p>
                        <div className="pt-2 flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => toast.info('Feature coming soon')}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Lesson Plan
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => toast.info('Feature coming soon')}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Students
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
