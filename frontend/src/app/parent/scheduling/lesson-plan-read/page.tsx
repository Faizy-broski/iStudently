'use client'

import { useState } from 'react'
import { useParentStudentLessonPlans } from '@/hooks/useParentDashboard'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { BookOpen, Loader2, AlertCircle, ChevronDown, ChevronRight, Clock, FileText, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO } from 'date-fns'

function RichText({ html }: { html?: string }) {
  if (!html) return <span className="text-muted-foreground italic text-sm">—</span>
  return <div className="prose prose-sm max-w-none dark:prose-invert text-sm" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function ParentLessonPlanReadPage() {
  const [selectedCpId, setSelectedCpId] = useState<string>('')
  const { coursePeriods, lessons, isLoading, error } = useParentStudentLessonPlans(selectedCpId || undefined)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <ParentDashboardLayout hideStats={true}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lesson Plan — Read</h1>
          <p className="text-muted-foreground mt-1">View published lesson plans for your child's courses</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading lesson plans</h3>
                <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Course period filter */}
            <div className="flex items-center gap-3">
              <Select value={selectedCpId || 'all'} onValueChange={v => setSelectedCpId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All Course Periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Course Periods</SelectItem>
                  {coursePeriods.map(cp => (
                    <SelectItem key={cp.id} value={cp.id}>{cp.title || cp.course_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{lessons.length} lesson plan{lessons.length !== 1 ? 's' : ''}</span>
            </div>

            {lessons.length === 0 ? (
              <Card>
                <CardContent className="text-center py-16">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-40" />
                  <p className="font-medium text-lg mb-2">No published lesson plans</p>
                  <p className="text-muted-foreground text-sm">
                    {coursePeriods.length === 0
                      ? 'Your child is not enrolled in any course periods yet.'
                      : 'No lesson plans have been published for your child\'s courses yet.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {lessons.map(lesson => {
                  const isOpen = expanded.has(lesson.id)
                  const cp = lesson.course_period
                  return (
                    <Card key={lesson.id} className="overflow-hidden">
                      <button
                        className="w-full text-left hover:bg-accent/30 transition-colors"
                        onClick={() => toggle(lesson.id)}
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isOpen
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="font-semibold">{lesson.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {cp && (
                                  <Badge variant="outline" className="text-xs">{cp.title || cp.course_title}</Badge>
                                )}
                                {lesson.on_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(parseISO(lesson.on_date), 'MMM d, yyyy')}
                                  </span>
                                )}
                                {lesson.length_minutes && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {lesson.length_minutes} min
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0 ml-2">Lesson {lesson.lesson_number}</Badge>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t px-6 py-4 space-y-4 bg-muted/10">
                          {lesson.learning_objectives && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Learning Objectives</p>
                              <RichText html={lesson.learning_objectives} />
                            </div>
                          )}

                          {lesson.items.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lesson Activities</p>
                              <div className="space-y-2">
                                {lesson.items.map((item, i) => (
                                  <div key={item.id} className="p-3 rounded-lg border bg-card text-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="text-xs">Step {i + 1}</Badge>
                                      {item.time_minutes && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />{item.time_minutes} min
                                        </span>
                                      )}
                                    </div>
                                    {item.learner_activity && (
                                      <div className="mb-1">
                                        <span className="text-xs font-medium text-muted-foreground">Learner Activity: </span>
                                        <RichText html={item.learner_activity} />
                                      </div>
                                    )}
                                    {item.learning_materials && (
                                      <div>
                                        <span className="text-xs font-medium text-muted-foreground">Materials: </span>
                                        <RichText html={item.learning_materials} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {lesson.files.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Attachments</p>
                              <div className="flex flex-wrap gap-2">
                                {lesson.files.map(f => (
                                  <a
                                    key={f.id}
                                    href={f.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-sm hover:bg-accent/30 transition-colors"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    {f.file_name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {lesson.evaluation && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Evaluation</p>
                              <RichText html={lesson.evaluation} />
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ParentDashboardLayout>
  )
}
