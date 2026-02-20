"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { Plus, Loader2, Trash2, BarChart3, Eye, Star, MessageSquare, Users } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import * as portalApi from "@/lib/api/portal"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { VisibilityPicker, type VisibilityState, type VisibilityMode } from "@/components/portal/visibility-picker"

const DATA_TYPES = [
  { value: 'single_choice', label: 'Select One from Options' },
  { value: 'multiple_choice', label: 'Select Multiple from Options' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'text', label: 'Text Response' },
]

interface QuestionRow {
  id?: string
  question_text: string
  options: string
  question_type: string
}

interface PollRow {
  id?: string
  title: string
  questions: QuestionRow[]
  show_results: boolean
  sort_order: number
  visible_from?: string
  visible_until?: string
  visibility: VisibilityState
  isNew?: boolean
}

interface QuestionResult {
  question_id: string
  question_text: string
  question_type: string
  total_responses: number
  options?: { option: string; count: number }[]
  text_responses?: string[]
  average_rating?: number
  rating_distribution?: { rating: number; count: number }[]
}

interface PollResults {
  poll: { id: string; title: string }
  total_responses: number
  questions: QuestionResult[]
}

// Convert ISO datetime to YYYY-MM-DD for <input type="date">
function toDateInput(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined
  return iso.substring(0, 10)
}

// Convert YYYY-MM-DD to ISO datetime
function fromDateInput(val: string | undefined): string | undefined {
  if (!val) return undefined
  return new Date(val).toISOString()
}

export default function PortalPollsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [polls, setPolls] = useState<PollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Results dialog state
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [currentResults, setCurrentResults] = useState<PollResults | null>(null)

  const getVisibilityMode = (poll: portalApi.PortalPoll): VisibilityMode => {
    if ((poll.visible_to_user_ids?.length ?? 0) > 0) return 'staff'
    return 'roles'
  }

  const openResultsDialog = async (pollId: string) => {
    setResultsDialogOpen(true)
    setLoadingResults(true)
    setCurrentResults(null)
    try {
      const data = await portalApi.getPollResults(pollId)
      setCurrentResults(data)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load results'
      toast.error(msg)
    } finally {
      setLoadingResults(false)
    }
  }

  const createEmptyQuestion = (): QuestionRow => ({
    question_text: '',
    options: '',
    question_type: 'single_choice',
  })

  const createEmptyRow = useCallback((sortOrder: number): PollRow => ({
    title: '',
    questions: [createEmptyQuestion()],
    show_results: false,
    sort_order: sortOrder,
    visible_from: undefined,
    visible_until: undefined,
    visibility: { mode: 'roles', roles: [], userIds: [], gradeIds: [] },
    isNew: true,
  }), [])

  const fetchPolls = useCallback(async () => {
    if (!profile?.school_id || !selectedCampus?.id) return

    setLoading(true)
    try {
      const result = await portalApi.getPolls({
        campus_id: selectedCampus.id,
        include_inactive: true,
      })

      const mappedPolls: PollRow[] = result.polls.map((poll) => ({
        id: poll.id,
        title: poll.title,
        questions: poll.questions?.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          options: q.options?.join('\n') || '',
          question_type: q.question_type,
        })) || [createEmptyQuestion()],
        show_results: poll.show_results,
        sort_order: poll.sort_order,
        visible_from: poll.visible_from,
        visible_until: poll.visible_until,
        visibility: {
          mode: getVisibilityMode(poll),
          roles: poll.visible_to_roles || [],
          userIds: poll.visible_to_user_ids || [],
          gradeIds: poll.visible_to_grade_ids || [],
        },
      }))

      mappedPolls.push(createEmptyRow(mappedPolls.length))
      setPolls(mappedPolls)
    } catch (error) {
      console.error('Error fetching polls:', error)
      toast.error('Failed to load polls')
      setPolls([createEmptyRow(0)])
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedCampus?.id, createEmptyRow])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  const updateRow = (index: number, updates: Partial<PollRow>) => {
    setPolls(polls.map((poll, i) =>
      i === index ? { ...poll, ...updates } : poll
    ))
  }

  const updateQuestion = (pollIndex: number, questionIndex: number, field: keyof QuestionRow, value: string) => {
    setPolls(polls.map((poll, i) => {
      if (i !== pollIndex) return poll
      return {
        ...poll,
        questions: poll.questions.map((q, qi) =>
          qi === questionIndex ? { ...q, [field]: value } : q
        ),
      }
    }))
  }

  const addQuestion = (pollIndex: number) => {
    setPolls(polls.map((poll, i) => {
      if (i !== pollIndex) return poll
      return {
        ...poll,
        questions: [...poll.questions, createEmptyQuestion()],
      }
    }))
  }

  const removeQuestion = (pollIndex: number, questionIndex: number) => {
    setPolls(polls.map((poll, i) => {
      if (i !== pollIndex) return poll
      const newQuestions = poll.questions.filter((_, qi) => qi !== questionIndex)
      return {
        ...poll,
        questions: newQuestions.length > 0 ? newQuestions : [createEmptyQuestion()],
      }
    }))
  }

  const deleteRow = async (index: number) => {
    const poll = polls[index]
    if (poll.id) {
      try {
        await portalApi.deletePoll(poll.id)
        toast.success('Poll deleted')
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to delete'
        toast.error(msg)
        return
      }
    }
    const newPolls = polls.filter((_, i) => i !== index)
    if (newPolls.length === 0 || !newPolls[newPolls.length - 1].isNew) {
      newPolls.push(createEmptyRow(newPolls.length))
    }
    setPolls(newPolls)
  }

  const handleSave = async () => {
    if (!selectedCampus?.id) {
      toast.error('Please select a campus first')
      return
    }

    setSaving(true)
    try {
      for (const poll of polls) {
        if (!poll.title.trim() && poll.questions.every((q) => !q.question_text.trim())) continue

        const validQuestions = poll.questions.filter((q) => q.question_text.trim())

        const dto: portalApi.CreatePollDTO & { visible_to_grade_ids?: string[]; visible_to_user_ids?: string[] } = {
          title: poll.title || 'Untitled Poll',
          sort_order: poll.sort_order,
          show_results: poll.show_results,
          visible_from: poll.visible_from || undefined,
          visible_until: poll.visible_until || undefined,
          visible_to_roles: poll.visibility.mode === 'roles' && poll.visibility.roles.length > 0
            ? poll.visibility.roles
            : ['admin', 'teacher', 'student', 'parent'],
          visible_to_grade_ids: poll.visibility.gradeIds,
          visible_to_user_ids: poll.visibility.mode !== 'roles' ? poll.visibility.userIds : [],
          campus_id: selectedCampus.id,
          questions: validQuestions.map((q, i) => ({
            question_text: q.question_text,
            question_type: q.question_type as 'single_choice' | 'multiple_choice' | 'text' | 'rating',
            options: q.options.split('\n').filter((o) => o.trim()),
            sort_order: i,
          })),
        }

        if (poll.id) {
          await portalApi.updatePoll(poll.id, dto)
        } else if (poll.title.trim() || validQuestions.length > 0) {
          await portalApi.createPoll(dto)
        }
      }
      toast.success('Polls saved successfully')
      fetchPolls()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save polls'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!selectedCampus?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select a Campus</h3>
        <p className="text-muted-foreground">Please select a campus from the top bar to manage polls.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-[#022172] flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-700">Portal Polls</h1>
      </div>

      {/* Top Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#022172] hover:bg-[#022172]/90"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </Button>
      </div>

      {/* Polls Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <p className="px-4 py-2 text-sm text-gray-500 italic">
            {polls.filter((p) => p.id).length === 0
              ? 'No polls were found.'
              : `${polls.filter((p) => p.id).length} poll(s) found.`}
          </p>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_100px_1fr_100px_80px_180px_140px] gap-2 px-4 py-2 bg-gray-50 border-y text-xs font-medium text-gray-600 uppercase tracking-wide">
            <div></div>
            <div>Title</div>
            <div>Poll</div>
            <div>Results</div>
            <div>Sort Order</div>
            <div>Visible Between</div>
            <div>Visible To</div>
          </div>

          {/* Table Rows */}
          {polls.map((poll, pollIndex) => (
            <div
              key={poll.id || `new-${pollIndex}`}
              className="grid grid-cols-[40px_100px_1fr_100px_80px_180px_140px] gap-2 px-4 py-3 border-b items-start"
            >
              {/* Add/Delete Button */}
              <div className="flex items-center pt-1">
                {poll.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteRow(pollIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span className="text-gray-400 text-lg">+</span>
                )}
              </div>

              {/* Title */}
              <div>
                <Input
                  value={poll.title}
                  onChange={(e) => updateRow(pollIndex, { title: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              {/* Poll Questions */}
              <div className="space-y-3">
                {poll.questions.map((question, qIndex) => (
                  <div key={qIndex} className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Question Title</label>
                        <Input
                          value={question.question_text}
                          onChange={(e) => updateQuestion(pollIndex, qIndex, 'question_text', e.target.value)}
                          placeholder=""
                          className="h-8 text-sm border-gray-300"
                        />
                      </div>
                      {poll.questions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-600 mt-5"
                          onClick={() => removeQuestion(pollIndex, qIndex)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Options (One per line)</label>
                      <Textarea
                        value={question.options}
                        onChange={(e) => updateQuestion(pollIndex, qIndex, 'options', e.target.value)}
                        placeholder=""
                        className="min-h-15 text-sm resize-y border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Data Type</label>
                      <Select
                        value={question.question_type}
                        onValueChange={(v) => updateQuestion(pollIndex, qIndex, 'question_type', v)}
                      >
                        <SelectTrigger className="h-8 text-xs border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((dt) => (
                            <SelectItem key={dt.value} value={dt.value} className="text-xs">
                              {dt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addQuestion(pollIndex)}
                  className="text-[#022172] text-sm hover:text-[#022172]/80 flex items-center gap-1 font-medium"
                >
                  <Plus className="h-3 w-3" />
                  New Question
                </button>
              </div>

              {/* Results */}
              <div className="pt-1 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={poll.show_results}
                    onCheckedChange={(checked) => updateRow(pollIndex, { show_results: !!checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-gray-600">Show to Users</span>
                </label>
                {poll.id && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-[#57A3CC] hover:bg-[#57A3CC]/90 text-white"
                    onClick={() => openResultsDialog(poll.id!)}
                  >
                    <Eye className="h-3 w-3 mr-1.5" />
                    View Results
                  </Button>
                )}
              </div>

              {/* Sort Order */}
              <div>
                <Input
                  type="number"
                  value={poll.sort_order}
                  onChange={(e) => updateRow(pollIndex, { sort_order: parseInt(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>

              {/* Visible Between */}
              <div>
                <DateRangePicker
                  from={toDateInput(poll.visible_from)}
                  to={toDateInput(poll.visible_until)}
                  onFromChange={(v) => updateRow(pollIndex, { visible_from: fromDateInput(v) })}
                  onToChange={(v) => updateRow(pollIndex, { visible_until: fromDateInput(v) })}
                />
              </div>

              {/* Visible To */}
              <div>
                {profile?.school_id && (
                  <VisibilityPicker
                    value={poll.visibility}
                    onChange={(vis: VisibilityState) => updateRow(pollIndex, { visibility: vis })}
                    schoolId={profile.school_id}
                    campusId={selectedCampus?.id}
                  />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#022172] hover:bg-[#022172]/90 px-8"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </Button>
      </div>

      {/* Results Dialog */}
      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#022172]" />
              Poll Results
            </DialogTitle>
          </DialogHeader>

          {loadingResults && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingResults && currentResults && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="flex items-center gap-3 p-4 bg-[#57A3CC]/10 rounded-lg border border-[#57A3CC]/20">
                <Users className="h-8 w-8 text-[#022172]" />
                <div>
                  <h3 className="font-semibold text-gray-800">{currentResults.poll.title}</h3>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-[#022172]">{currentResults.total_responses}</span> total response{currentResults.total_responses !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Questions Results */}
              {currentResults.questions.map((question, index) => (
                <div key={question.question_id} className="border rounded-lg p-4">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      {question.question_text}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {question.total_responses} response{question.total_responses !== 1 ? 's' : ''} •
                      {question.question_type === 'single_choice' && ' Single Choice'}
                      {question.question_type === 'multiple_choice' && ' Multiple Choice'}
                      {question.question_type === 'rating' && ' Rating'}
                      {question.question_type === 'text' && ' Text Response'}
                    </p>
                  </div>

                  {/* Choice Questions */}
                  {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && question.options && (
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => {
                        const percentage = question.total_responses > 0
                          ? Math.round((option.count / question.total_responses) * 100)
                          : 0
                        return (
                          <div key={optIndex} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-700">{option.option}</span>
                              <span className="text-gray-500 font-medium">
                                {option.count} ({percentage}%)
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Rating Questions */}
                  {question.question_type === 'rating' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                        <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                        <div>
                          <p className="text-xl font-bold text-gray-800">
                            {question.average_rating?.toFixed(1) || '0.0'}
                          </p>
                          <p className="text-xs text-gray-500">Average Rating</p>
                        </div>
                      </div>
                      {question.rating_distribution && (
                        <div className="space-y-1">
                          {question.rating_distribution.sort((a, b) => b.rating - a.rating).map((item) => {
                            const percentage = question.total_responses > 0
                              ? Math.round((item.count / question.total_responses) * 100)
                              : 0
                            return (
                              <div key={item.rating} className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5 w-14">
                                  {Array.from({ length: item.rating }).map((_, i) => (
                                    <Star key={i} className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                  ))}
                                </div>
                                <Progress value={percentage} className="flex-1 h-2" />
                                <span className="text-xs text-gray-500 w-14 text-right">
                                  {item.count} ({percentage}%)
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Responses */}
                  {question.question_type === 'text' && question.text_responses && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {question.text_responses.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No responses yet</p>
                      ) : (
                        question.text_responses.map((response, rIndex) => (
                          <div key={rIndex} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                            <MessageSquare className="h-3 w-3 text-gray-400 mt-0.5" />
                            <p className="text-sm text-gray-700">{response}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}

              {currentResults.questions.length === 0 && (
                <p className="text-center text-gray-500 py-4">No questions in this poll</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
