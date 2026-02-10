"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { BarChart3, ArrowLeft, Calendar, CheckCircle2, Loader2 } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useParentDashboardSafe } from "@/context/ParentDashboardContext"
import * as portalApi from "@/lib/api/portal"
import { format } from "date-fns"
import Link from "next/link"
import { markPortalItemViewed } from "@/lib/utils/portal-storage"

export default function ParentPortalPollsPage() {
  const { profile } = useAuth()
  const parentDashboard = useParentDashboardSafe()
  const [polls, setPolls] = useState<portalApi.PortalPoll[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [responses, setResponses] = useState<Record<string, Record<string, string | string[] | number>>>({})

  // Use selected student's campus for filtering
  const selectedStudentCampus = parentDashboard?.selectedStudentData?.campus_id

  const fetchPolls = useCallback(async () => {
    if (!profile?.school_id || !selectedStudentCampus) {
      console.log('📊 Parent polls: Missing campus info', { 
        schoolId: profile?.school_id, 
        selectedStudentCampus 
      })
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const result = await portalApi.getPolls({ campus_id: selectedStudentCampus, limit: 100 })
      setPolls(result.polls)
      result.polls.forEach(poll => markPortalItemViewed('poll', poll.id))
    } catch (error) {
      console.error('Error fetching polls:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedStudentCampus])

  useEffect(() => { fetchPolls() }, [fetchPolls])

  const handleResponseChange = (pollId: string, questionId: string, value: string | string[] | number) => {
    setResponses(prev => ({ ...prev, [pollId]: { ...prev[pollId], [questionId]: value } }))
  }

  const handleSubmitPoll = async (poll: portalApi.PortalPoll) => {
    if (!poll.questions?.length) return
    const pollResponses = responses[poll.id] || {}
    const missingRequired = poll.questions.filter(q => q.is_required && !pollResponses[q.id])
    if (missingRequired.length > 0) { toast.error('Please answer all required questions'); return }

    setSubmitting(poll.id)
    try {
      const formattedResponses: portalApi.PollResponseDTO[] = poll.questions
        .filter(q => pollResponses[q.id])
        .map(q => {
          const answer = pollResponses[q.id]
          return {
            question_id: q.id,
            answer_text: q.question_type === 'text' ? String(answer) : undefined,
            selected_options: ['single_choice', 'multiple_choice'].includes(q.question_type) ? (Array.isArray(answer) ? answer.map(String) : [String(answer)]) : undefined,
            rating_value: q.question_type === 'rating' ? Number(answer) : undefined
          }
        })
      await portalApi.submitPollResponses(poll.id, formattedResponses)
      toast.success('Response submitted successfully!')
      setPolls(polls.map(p => p.id === poll.id ? { ...p, has_voted: true } : p))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit response'
      toast.error(errorMessage)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4 mb-6"><Skeleton className="h-10 w-10" /><Skeleton className="h-8 w-48" /></div>
        {[1, 2].map(i => <Skeleton key={i} className="h-64 w-full" />)}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/parent/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">Polls & Surveys</h1>
          <p className="text-muted-foreground">Participate in school polls and surveys</p>
        </div>
      </div>

      {polls.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Polls</h3>
          <p className="text-muted-foreground">There are no polls available at this time.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => (
            <Card key={poll.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{poll.title}</CardTitle>
                    {poll.description && <CardDescription className="mt-1">{poll.description}</CardDescription>}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(poll.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  {poll.has_voted && <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Voted</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                {poll.has_voted ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p>Thank you for your response!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {poll.questions?.map((question, qIndex) => {
                      const questionResponse = responses[poll.id]?.[question.id]
                      return (
                      <div key={question.id} className="space-y-3">
                        <Label className="text-base font-medium">{qIndex + 1}. {question.question_text}{question.is_required && <span className="text-red-500 ml-1">*</span>}</Label>
                        {question.question_type === 'single_choice' && (
                          <RadioGroup value={typeof questionResponse === 'string' ? questionResponse : ''} onValueChange={(value) => handleResponseChange(poll.id, question.id, value)}>
                            {(question.options as Array<string | { value: string; label: string }>)?.map((option, i) => {
                              const optionValue = typeof option === 'string' ? option : option.value
                              const optionLabel = typeof option === 'string' ? option : option.label
                              return (<div key={i} className="flex items-center space-x-2"><RadioGroupItem value={optionValue} id={`${question.id}-${i}`} /><Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{optionLabel}</Label></div>)
                            })}
                          </RadioGroup>
                        )}
                        {question.question_type === 'multiple_choice' && (
                          <div className="space-y-2">
                            {(question.options as Array<string | { value: string; label: string }>)?.map((option, i) => {
                              const optionValue = typeof option === 'string' ? option : option.value
                              const optionLabel = typeof option === 'string' ? option : option.label
                              const selected = Array.isArray(questionResponse) ? questionResponse : []
                              return (<div key={i} className="flex items-center space-x-2"><Checkbox id={`${question.id}-${i}`} checked={selected.includes(optionValue)} onCheckedChange={(checked) => { const newSelected = checked ? [...selected, optionValue] : selected.filter((v: string) => v !== optionValue); handleResponseChange(poll.id, question.id, newSelected) }} /><Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{optionLabel}</Label></div>)
                            })}
                          </div>
                        )}
                        {question.question_type === 'text' && <Textarea placeholder="Enter your response..." value={typeof questionResponse === 'string' ? questionResponse : ''} onChange={(e) => handleResponseChange(poll.id, question.id, e.target.value)} />}
                        {question.question_type === 'rating' && (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (<Button key={rating} type="button" variant={questionResponse === rating ? "default" : "outline"} className="w-10 h-10" onClick={() => handleResponseChange(poll.id, question.id, rating)}>{rating}</Button>))}
                          </div>
                        )}
                      </div>
                    )})}
                    <Button className="w-full bg-[#022172] hover:bg-[#022172]/90" onClick={() => handleSubmitPoll(poll)} disabled={submitting === poll.id}>
                      {submitting === poll.id ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Response'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
