"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Bell, 
  FileText, 
  BarChart3, 
  Check,
  ExternalLink,
  Pin,
  Loader2
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { useParentDashboardSafe } from "@/context/ParentDashboardContext"
import * as portalApi from "@/lib/api/portal"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getViewedPortalItems, markMultiplePortalItemsViewed } from "@/lib/utils/portal-storage"
import { useRouter } from "next/navigation"

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const parentDashboard = useParentDashboardSafe()
  const supabase = createClient()
  const router = useRouter()

  // For non-admin users, use their assigned campus_id from profile
  // For admins, use the selected campus from the dropdown
  // For parents, use the selected student's campus from ParentDashboardContext
  const effectiveCampusId = profile?.role === 'admin' 
    ? selectedCampus?.id 
    : profile?.role === 'parent' && parentDashboard?.selectedStudentData?.campus_id
    ? parentDashboard.selectedStudentData.campus_id
    : profile?.campus_id
  
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<portalApi.PortalNote[]>([])
  const [polls, setPolls] = useState<portalApi.PortalPoll[]>([])
  const [loading, setLoading] = useState(false)
  const [hasNewContent, setHasNewContent] = useState(false)
  const [viewedNotes, setViewedNotes] = useState<string[]>([])
  const [viewedPolls, setViewedPolls] = useState<string[]>([])

  // Load viewed items from localStorage
  useEffect(() => {
    setViewedNotes(getViewedPortalItems('note'))
    setViewedPolls(getViewedPortalItems('poll'))
  }, [])

  const fetchContent = useCallback(async () => {
    if (!profile?.school_id || !effectiveCampusId) {
      console.log('🔔 NotificationBell: Missing campus info', { 
        role: profile?.role, 
        effectiveCampusId,
        selectedStudentCampus: parentDashboard?.selectedStudentData?.campus_id
      })
      return
    }

    setLoading(true)
    try {
      const [notesResult, pollsResult] = await Promise.all([
        portalApi.getNotes({ campus_id: effectiveCampusId, limit: 20 }),
        portalApi.getPolls({ campus_id: effectiveCampusId, limit: 20 })
      ])
      setNotes(notesResult.notes)
      setPolls(pollsResult.polls)
      setHasNewContent(false)
    } catch (error) {
      console.error('Error fetching portal content:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, effectiveCampusId])

  // Fetch on mount and when campus changes
  useEffect(() => {
    fetchContent()
  }, [fetchContent])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!effectiveCampusId) return

    const notesChannel = supabase
      .channel('portal-notes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portal_notes',
          filter: `campus_id=eq.${effectiveCampusId}`
        },
        (payload) => {
          console.log('Portal note change:', payload)
          setHasNewContent(true)
          // Auto-refresh if popover is open
          if (open) {
            fetchContent()
          }
        }
      )
      .subscribe()

    const pollsChannel = supabase
      .channel('portal-polls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portal_polls',
          filter: `campus_id=eq.${effectiveCampusId}`
        },
        (payload) => {
          console.log('Portal poll change:', payload)
          setHasNewContent(true)
          if (open) {
            fetchContent()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notesChannel)
      supabase.removeChannel(pollsChannel)
    }
  }, [effectiveCampusId, supabase, open, fetchContent])

  // Fetch content when popover opens
  useEffect(() => {
    if (open) {
      fetchContent()
    }
  }, [open, fetchContent])

  // Calculate unread counts (items not in viewed list)
  const unreadNotesCount = useMemo(() => {
    return notes.filter(n => !viewedNotes.includes(n.id)).length
  }, [notes, viewedNotes])

  const unreadPollsCount = useMemo(() => {
    return polls.filter(p => !p.has_voted && !viewedPolls.includes(p.id)).length
  }, [polls, viewedPolls])

  const totalUnread = unreadNotesCount + unreadPollsCount
  const showBadge = hasNewContent || totalUnread > 0

  // Get the portal base path based on role
  const getPortalPath = (type: 'notes' | 'polls') => {
    const role = profile?.role
    if (role === 'admin') return `/admin/portal/${type}`
    if (role === 'teacher') return `/teacher/portal/${type}`
    if (role === 'parent') return `/parent/portal/${type}`
    return `/student/portal/${type}`
  }

  // Mark items as viewed when navigating to full page
  const handleViewAll = (type: 'notes' | 'polls') => {
    if (type === 'notes') {
      markMultiplePortalItemsViewed('note', notes.map(n => n.id))
      setViewedNotes(prev => [...prev, ...notes.map(n => n.id)])
    } else {
      markMultiplePortalItemsViewed('poll', polls.map(p => p.id))
      setViewedPolls(prev => [...prev, ...polls.map(p => p.id)])
    }
    setOpen(false)
    router.push(getPortalPath(type))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
        >
          <Bell className={cn("h-5 w-5", hasNewContent && "animate-pulse text-primary")} />
          {showBadge && (
            <Badge 
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs",
                hasNewContent ? "bg-primary animate-bounce" : "bg-red-500"
              )}
            >
              {hasNewContent ? "!" : totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-[#022172]">Portal</h4>
            <p className="text-sm text-muted-foreground">
              {profile?.role === 'parent' && parentDashboard?.selectedStudentData
                ? `Notifications for ${parentDashboard.selectedStudentData.first_name} ${parentDashboard.selectedStudentData.last_name} (${parentDashboard.selectedStudentData.campus_name})`
                : 'Announcements and polls'
              }
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchContent}
            disabled={loading}
            className="h-8 w-8"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </Button>
        </div>

        <Tabs defaultValue="notes" className="w-full">
          <TabsList className="w-full rounded-none border-b">
            <TabsTrigger value="notes" className="flex-1 gap-2">
              <FileText className="h-4 w-4" />
              Notes
              {unreadNotesCount > 0 && (
                <Badge className="h-5 bg-red-500">
                  {unreadNotesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="polls" className="flex-1 gap-2">
              <BarChart3 className="h-4 w-4" />
              Polls
              {unreadPollsCount > 0 && (
                <Badge className="h-5 bg-red-500">
                  {unreadPollsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="m-0">
            <ScrollArea className="h-72">
              {loading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No announcements
                </div>
              ) : (
                <div className="divide-y">
                  {notes.slice(0, 5).map((note) => (
                    <NoteItem 
                      key={note.id} 
                      note={note} 
                      isNew={!viewedNotes.includes(note.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            {notes.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  className="w-full text-[#022172]"
                  onClick={() => handleViewAll('notes')}
                >
                  View All Announcements ({notes.length})
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="polls" className="m-0">
            <ScrollArea className="h-72">
              {loading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : polls.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No active polls
                </div>
              ) : (
                <div className="divide-y">
                  {polls.slice(0, 5).map((poll) => (
                    <PollItem 
                      key={poll.id} 
                      poll={poll}
                      isNew={!poll.has_voted && !viewedPolls.includes(poll.id)}
                      onVoted={() => {
                        setPolls(polls.map(p => 
                          p.id === poll.id ? { ...p, has_voted: true } : p
                        ))
                      }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            {polls.length > 0 && (
              <div className="p-2 border-t">
                <Button 
                  variant="ghost" 
                  className="w-full text-[#022172]"
                  onClick={() => handleViewAll('polls')}
                >
                  View All Polls ({polls.length})
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}

function NoteItem({ note, isNew }: { note: portalApi.PortalNote; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div 
      className={cn(
        "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
        isNew && "bg-blue-50 border-l-2 border-[#022172]"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        {note.is_pinned && (
          <Pin className="h-4 w-4 text-[#022172] mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{note.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
          </p>
          
          {expanded && (
            <div className="mt-2 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              
              {note.file_url && (
                <a 
                  href={note.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#022172] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText className="h-4 w-4" />
                  {note.file_name || 'Attachment'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              
              {note.embed_link && (
                <a 
                  href={note.embed_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#022172] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Link
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PollItem({ 
  poll, 
  isNew,
  onVoted 
}: { 
  poll: portalApi.PortalPoll
  isNew?: boolean
  onVoted: () => void 
}) {
  const [expanded, setExpanded] = useState(false)
  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [hasVoted, setHasVoted] = useState(poll.has_voted || false)

  const handleResponseChange = (questionId: string, value: string | string[]) => {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    const answers = Object.entries(responses).map(([question_id, answer]) => ({
      question_id,
      answer_text: Array.isArray(answer) ? answer.join(', ') : answer,
      selected_options: Array.isArray(answer) ? answer : [answer]
    }))

    if (answers.length === 0) {
      toast.error('Please answer at least one question')
      return
    }

    setSubmitting(true)
    try {
      await portalApi.submitPollResponses(poll.id, answers)
      toast.success('Response submitted!')
      setHasVoted(true)
      onVoted()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div 
      className={cn(
        "p-3 cursor-pointer hover:bg-gray-50 transition-colors",
        isNew && "bg-blue-50 border-l-2 border-[#022172]"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <BarChart3 className="h-4 w-4 text-[#022172] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{poll.title}</p>
            {hasVoted && (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Voted
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {poll.questions?.length || 0} question{(poll.questions?.length || 0) !== 1 ? 's' : ''}
          </p>

          {expanded && !hasVoted && (
            <div className="mt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
              {poll.questions?.map((question) => (
                <div key={question.id} className="space-y-2">
                  <p className="text-sm font-medium">{question.question_text}</p>
                  
                  {question.question_type === 'single_choice' && (
                    <div className="space-y-1">
                      {question.options?.map((option, idx) => {
                        const optionValue = typeof option === 'string' ? option : option.value
                        const optionLabel = typeof option === 'string' ? option : option.label
                        return (
                        <label 
                          key={idx} 
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`q_${question.id}`}
                            value={optionValue}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            className="text-[#022172]"
                          />
                          {optionLabel}
                        </label>
                      )})}
                    </div>
                  )}
                  
                  {question.question_type === 'multiple_choice' && (
                    <div className="space-y-1">
                      {question.options?.map((option, idx) => {
                        const optionValue = typeof option === 'string' ? option : option.value
                        const optionLabel = typeof option === 'string' ? option : option.label
                        return (
                        <label 
                          key={idx} 
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            value={optionValue}
                            onChange={(e) => {
                              const current = (responses[question.id] as string[]) || []
                              const newValue = e.target.checked
                                ? [...current, optionValue]
                                : current.filter(v => v !== optionValue)
                              handleResponseChange(question.id, newValue)
                            }}
                            className="text-[#022172]"
                          />
                          {optionLabel}
                        </label>
                      )})}
                    </div>
                  )}

                  {question.question_type === 'rating' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          className={cn(
                            "h-8 w-8 rounded-full border text-sm font-medium transition-colors",
                            responses[question.id] === String(rating)
                              ? "bg-[#022172] text-white border-[#022172]"
                              : "hover:bg-gray-100"
                          )}
                          onClick={() => handleResponseChange(question.id, String(rating))}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  )}

                  {question.question_type === 'text' && (
                    <textarea
                      className="w-full border rounded-md p-2 text-sm"
                      rows={2}
                      placeholder="Your answer..."
                      onChange={(e) => handleResponseChange(question.id, e.target.value)}
                    />
                  )}
                </div>
              ))}

              <Button
                size="sm"
                className="bg-[#022172] hover:bg-[#022172]/90"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Response'}
              </Button>
            </div>
          )}

          {expanded && hasVoted && (
            <div className="mt-3 py-4 text-center text-sm text-muted-foreground">
              Thank you for your response!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
