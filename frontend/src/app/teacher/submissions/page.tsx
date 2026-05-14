"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, CheckSquare, FileText, Clock, Award, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import useSWR, { mutate } from 'swr'
import * as assignmentsApi from '@/lib/api/assignments'
import { Assignment, AssignmentSubmission } from '@/types'

const assignmentsFetcher = async (url: string) => {
  const [, staffId] = url.split('|')
  const response = await assignmentsApi.getTeacherAssignments(staffId, { is_archived: false })
  return response.data || [] // Extract data array from paginated response
}

const submissionsFetcher = async (url: string) => {
  const [, assignmentId] = url.split('|')
  return await assignmentsApi.getAssignmentSubmissions(assignmentId)
}

export default function SubmissionsPage() {
  const { profile } = useAuth()
  const [selectedAssignment, setSelectedAssignment] = useState<string>('')
  const [filteredSubmissions, setFilteredSubmissions] = useState<AssignmentSubmission[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Grading dialog
  const [isGradingOpen, setIsGradingOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null)
  const [gradeForm, setGradeForm] = useState({
    score: '',
    feedback: ''
  })

  // Use SWR for assignments
  const { data: assignments, isLoading: loadingAssignments } = useSWR<Assignment[]>(
    profile?.staff_id ? `teacher-assignments|${profile.staff_id}` : null,
    assignmentsFetcher,
    { revalidateOnFocus: false }
  )

  // Use SWR for submissions
  const { data: submissions, isLoading: loadingSubmissions, mutate: mutateSubmissions } = useSWR<AssignmentSubmission[]>(
    selectedAssignment ? `assignment-submissions|${selectedAssignment}` : null,
    submissionsFetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    filterSubmissions()
  }, [submissions, statusFilter, searchQuery])

  const filterSubmissions = () => {
    let filtered = [...(submissions || [])]

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter)
    }

    // Filter by search query (student name)
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.student?.profile?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student?.profile?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setFilteredSubmissions(filtered)
  }

  const loadAssignments = async () => {
    try {
      setLoading(true)
      const data = await assignmentsApi.getTeacherAssignments(profile!.staff_id!, {
        is_archived: false
      })
      setAssignments(data)
    } catch (error: any) {
      console.error('Error loading assignments:', error)
      toast.error(error.message || 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const loadSubmissions = async () => {
    if (!selectedAssignment) return
    
    try {
      setLoading(true)
      const data = await assignmentsApi.getAssignmentSubmissions(selectedAssignment)
      setSubmissions(data)
    } catch (error: any) {
      console.error('Error loading submissions:', error)
      toast.error(error.message || 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const handleGradeClick = (submission: AssignmentSubmission) => {
    setSelectedSubmission(submission)
    setGradeForm({
      score: submission.score?.toString() || '',
      feedback: submission.feedback || ''
    })
    setIsGradingOpen(true)
  }

  const handleGradeSubmit = async () => {
    if (!selectedSubmission || !profile?.staff_id) return

    const score = parseFloat(gradeForm.score)
    if (isNaN(score) || score < 0) {
      toast.error('Please enter a valid score')
      return
    }

    try {
      await assignmentsApi.gradeSubmission(selectedSubmission.id, {
        score,
        feedback: gradeForm.feedback.trim(),
        graded_by: profile.id
      })
      toast.success('Submission graded successfully')
      setIsGradingOpen(false)
      // Revalidate submissions data
      mutateSubmissions()
    } catch (error: any) {
      console.error('Error grading submission:', error)
      toast.error(error.message || 'Failed to grade submission')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700'
      case 'submitted': return 'bg-blue-100 text-blue-700'
      case 'late': return 'bg-orange-100 text-orange-700'
      case 'graded': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const stats = {
    total: submissions?.length || 0,
    pending: submissions?.filter(s => s.status === 'pending').length || 0,
    submitted: submissions?.filter(s => s.status === 'submitted' || s.status === 'late').length || 0,
    graded: submissions?.filter(s => s.status === 'graded').length || 0
  }

  const loading = loadingAssignments || loadingSubmissions

  if (loading && !assignments) {
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
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Submissions</h1>
        <p className="text-muted-foreground mt-1">
          Review and grade student assignment submissions
        </p>
      </div>

      {/* Assignment Selector */}
      <Card className="p-6">
        <label className="text-sm font-medium mb-2 block">Select Assignment</label>
        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an assignment to view submissions" />
          </SelectTrigger>
          <SelectContent>
            {(assignments || []).map(assignment => (
              <SelectItem key={assignment.id} value={assignment.id}>
                {assignment.title} - {assignment.section?.name} ({assignment.subject?.name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {selectedAssignment && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="text-xl font-bold">{stats.submitted}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Graded</p>
                  <p className="text-xl font-bold">{stats.graded}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="graded">Graded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Submissions List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Submissions Found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== 'all' ? 'Try changing the filter.' : 'No submissions yet for this assignment.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => (
                <Card key={submission.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">
                          {submission.student?.profile?.first_name} {submission.student?.profile?.last_name}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(submission.status)}`}>
                          {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {submission.submitted_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                          </span>
                        )}
                        {submission.score !== null && (
                          <span className="flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            Score: {submission.score}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleGradeClick(submission)}
                      variant={submission.status === 'graded' ? 'outline' : 'default'}
                      style={submission.status !== 'graded' ? { background: 'var(--gradient-blue)' } : undefined}
                      className={submission.status !== 'graded' ? 'text-white' : ''}
                    >
                      {submission.status === 'graded' ? 'View Grade' : 'Grade'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Grading Dialog */}
      <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Grade Submission - {selectedSubmission?.student?.profile?.first_name} {selectedSubmission?.student?.profile?.last_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Submission Content */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Student Submission</h3>
              
              {/* Submission Text */}
              {selectedSubmission?.submission_text && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Submission Text:</label>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="whitespace-pre-wrap">{selectedSubmission.submission_text}</p>
                  </div>
                </div>
              )}

              {/* Attachments */}
              {selectedSubmission?.attachments && selectedSubmission.attachments.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Attachments ({selectedSubmission.attachments.length}):</label>
                  <div className="space-y-2">
                    {selectedSubmission.attachments.map((attachment: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium">
                            {attachment.url ? `File ${index + 1}` : attachment.name || `Attachment ${index + 1}`}
                          </span>
                          {attachment.uploaded_at && (
                            <span className="text-xs text-gray-500">
                              Uploaded: {new Date(attachment.uploaded_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {attachment.url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(attachment.url, '_blank')}
                            className="ml-3"
                          >
                            Download
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedSubmission?.submission_text && (!selectedSubmission?.attachments || selectedSubmission.attachments.length === 0) && (
                <div className="bg-gray-50 p-4 rounded-lg border text-center text-gray-500">
                  No submission content available
                </div>
              )}
            </div>

            {/* Grading Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Grade This Submission</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Score <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter score"
                    value={gradeForm.score}
                    onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Feedback</label>
                  <Textarea
                    placeholder="Enter feedback for the student..."
                    value={gradeForm.feedback}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                    rows={6}
                  />
                </div>

                {selectedSubmission?.submitted_at && (
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Submitted At:</strong> {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGradingOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGradeSubmit}
              style={{ background: 'var(--gradient-blue)' }}
              className="text-white"
            >
              Submit Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
