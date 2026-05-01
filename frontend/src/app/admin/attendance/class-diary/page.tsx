"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Download,
  Minus,
  Plus,
  MessageSquare,
  Trash2,
  Calendar,
  Send,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import * as classDiaryApi from "@/lib/api/class-diary"
import type { DiaryEntry, DiaryComment } from "@/lib/api/class-diary"

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00")
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

export default function ClassDiaryReadPage() {
  const t = useTranslations('attendance')
  const locale = useLocale()

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const formatEntryTime = (timeStr?: string): string => {
    if (!timeStr) return ""
    try {
      if (timeStr.includes("T")) {
        return new Date(timeStr).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      }
      const [h, m, s] = timeStr.split(":")
      const date = new Date()
      date.setHours(parseInt(h), parseInt(m), parseInt(s || "0"))
      return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    } catch { return timeStr }
  }

  const formatTimestamp = (ts: string): string => {
    try {
      const d = new Date(ts)
      return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "2-digit" }) +
        " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    } catch { return ts }
  }

  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const isAdminOrTeacher = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "teacher"

  // Academic data
  const { gradeLevels, loading: gradeLevelsLoading } = useGradeLevels()
  const { sections, loading: sectionsLoading } = useSections()

  // Filter state
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedGrade, setSelectedGrade] = useState<string>("all")
  const [selectedSection, setSelectedSection] = useState<string>("all")

  // Data state
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(new Set())
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<string | null>(null)

  // Filtered sections by grade
  const filteredSections = useMemo(() => {
    if (!selectedGrade || selectedGrade === "all") return sections
    return sections.filter(s => s.grade_level_id === selectedGrade && s.is_active)
  }, [sections, selectedGrade])

  // Navigate date
  const navigateDate = useCallback((delta: number) => {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + delta)
    const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setSelectedDate(newStr)
  }, [selectedDate])

  // Load diary entries
  const loadEntries = useCallback(async () => {
    if (!selectedDate) return
    setLoading(true)
    try {
      const params: Parameters<typeof classDiaryApi.getDiaryReadView>[0] = {
        diary_date: selectedDate,
        campus_id: selectedCampus?.id,
      }
      if (selectedSection && selectedSection !== "all") {
        params.section_id = selectedSection
      }

      const result = await classDiaryApi.getDiaryReadView(params)
      if (result.success && result.data) {
        setEntries(result.data)
      } else {
        setEntries([])
        if (result.error && result.error !== "Session expired") {
          toast.error(result.error)
        }
      }
    } catch {
      toast.error(t('diary_loadFailed'))
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedSection, selectedCampus?.id])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // Reset section when grade changes
  useEffect(() => {
    setSelectedSection("all")
  }, [selectedGrade])

  // Toggle collapse
  const toggleCollapse = (entryId: string) => {
    setCollapsedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  // Toggle comments for entry
  const handleToggleComments = async (entryId: string, currentState: boolean) => {
    try {
      const result = await classDiaryApi.toggleComments(entryId, !currentState)
      if (result.success) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, enable_comments: !currentState } : e))
        toast.success(!currentState ? t('diary_commentsEnabled') : t('diary_commentsDisabled'))
      } else {
        toast.error(result.error || t('diary_toggleFailed'))
      }
    } catch {
      toast.error(t('diary_toggleFailed'))
    }
  }

  // Add comment
  const handleAddComment = async (entryId: string) => {
    const text = commentTexts[entryId]?.trim()
    if (!text) return

    setSubmittingComment(entryId)
    try {
      const result = await classDiaryApi.addDiaryComment(entryId, text)
      if (result.success && result.data) {
        setEntries(prev => prev.map(e => {
          if (e.id === entryId) {
            return { ...e, comments: [...(e.comments || []), result.data!] }
          }
          return e
        }))
        setCommentTexts(prev => ({ ...prev, [entryId]: "" }))
        toast.success(t('diary_commentAdded'))
      } else {
        toast.error(result.error || t('diary_commentFailed'))
      }
    } catch {
      toast.error(t('diary_commentFailed'))
    } finally {
      setSubmittingComment(null)
    }
  }

  // Delete comment
  const handleDeleteComment = async (entryId: string, commentId: string) => {
    try {
      const result = await classDiaryApi.deleteDiaryComment(commentId)
      if (result.success) {
        setEntries(prev => prev.map(e => {
          if (e.id === entryId) {
            return { ...e, comments: (e.comments || []).filter(c => c.id !== commentId) }
          }
          return e
        }))
        toast.success(t('diary_commentDeleted'))
      } else {
        toast.error(result.error || t('diary_commentDeleteFailed'))
      }
    } catch {
      toast.error(t('diary_commentDeleteFailed'))
    }
  }

  // Get display info for an entry
  const getEntryHeader = (entry: DiaryEntry) => {
    const sectionName = entry.section?.name || "Section"
    const gradeName = entry.section?.grade_level?.name || ""
    const subjectName = entry.subject?.name || "General"
    const teacherName = entry.teacher?.profile
      ? `${entry.teacher.profile.first_name || ""} ${entry.teacher.profile.last_name || ""}`.trim()
      : "Teacher"
    const rawDay = entry.day_of_week !== undefined && entry.day_of_week !== null
      ? entry.day_of_week
      : getDayOfWeek(entry.diary_date)
    const refDate = new Date(2000, 0, 2 + rawDay) // Jan 2 2000 = Monday
    const dayName = refDate.toLocaleDateString(locale, { weekday: "long" })

    return { sectionName, gradeName, subjectName, teacherName, dayName }
  }

  const dataLoading = gradeLevelsLoading || sectionsLoading

  if (!campusContext) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('classDiaryRead')}</h1>
          <p className="text-sm text-muted-foreground">{t('diary_subtitle_read')}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate(-1)} title="Previous Day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background min-w-50 justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-0 p-0 h-auto focus-visible:ring-0 w-35"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateDate(1)} title="Next Day">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Grade Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('diary_gradeLevel')}</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade} disabled={dataLoading}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder={t('diary_allGrades')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('diary_allGrades')}</SelectItem>
                  {gradeLevels.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('diary_sectionLabel')}</label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={dataLoading}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder={t('diary_allSections')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('diary_allSections')}</SelectItem>
                  {filteredSections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={() => setSelectedDate(todayStr)} className="ml-auto">
              {t('diary_today')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Date + Day Display */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span className="font-medium text-foreground">{formatDate(selectedDate)}</span>
        <Badge variant="outline">{new Date(selectedDate + "T00:00:00").toLocaleDateString(locale, { weekday: "long" })}</Badge>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-muted-foreground">{t('diary_noEntries')}</h3>
              <p className="text-sm text-muted-foreground/70">{t('diary_noEntriesFound')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diary Entries */}
      {!loading && entries.length > 0 && (
        <div className="space-y-6">
          {entries.map(entry => {
            const { sectionName, gradeName, subjectName, teacherName, dayName } = getEntryHeader(entry)
            const isCollapsed = collapsedEntries.has(entry.id)

            return (
              <Card key={entry.id} className="overflow-hidden">
                {/* Entry Header Bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{dayName}</Badge>
                    <span className="font-medium">
                      {gradeName && `${gradeName} — `}{sectionName} — {subjectName}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">{teacherName}</span>
                </div>

                {/* Enable Comments Toggle - Admin/Teacher only */}
                {isAdminOrTeacher && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
                    <Checkbox
                      id={`enable-comments-${entry.id}`}
                      checked={entry.enable_comments}
                      onCheckedChange={() => handleToggleComments(entry.id, entry.enable_comments)}
                    />
                    <label
                      htmlFor={`enable-comments-${entry.id}`}
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      {t('diary_enableComments')}
                    </label>
                  </div>
                )}

                {/* Entry Content */}
                <CardContent className="pt-4 relative">
                  {/* Collapse Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => toggleCollapse(entry.id)}
                    title={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  </Button>

                  {!isCollapsed && (
                    <div className="space-y-4 pr-8">
                      {/* Rich text content */}
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: entry.content }}
                      />

                      {/* Timestamp */}
                      {entry.entry_time && (
                        <p className="text-sm text-muted-foreground">{formatEntryTime(entry.entry_time)}</p>
                      )}

                      {/* File Attachments */}
                      {entry.files && entry.files.length > 0 && (
                        <div className="space-y-2">
                          {entry.files.map(file => (
                            <div key={file.id} className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {file.file_name}
                              </a>
                              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                <a href={file.file_url} download={file.file_name} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">{t('diary_fileAttached')}</p>
                        </div>
                      )}

                      <Separator />

                      {/* Created timestamp */}
                      <p className="text-xs text-muted-foreground">{formatTimestamp(entry.created_at)}</p>

                      {/* Comments Section */}
                      {entry.enable_comments && (
                        <div className="space-y-3 border-t pt-4">
                          {/* Existing Comments */}
                          {(entry.comments || []).map((comment: DiaryComment) => (
                            <div key={comment.id} className="flex items-start gap-2 group">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Minus className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium">{comment.content}</span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-5">
                                  {formatTimestamp(comment.created_at)}
                                  {comment.author && (
                                    <> — {comment.author.first_name} {comment.author.last_name}</>
                                  )}
                                </p>
                              </div>
                              {/* Delete: own comment or admin */}
                              {(comment.author_id === profile?.id || isAdminOrTeacher) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeleteComment(entry.id, comment.id)}
                                  title="Delete comment"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))}

                          {/* Add Comment */}
                          <div className="flex items-center gap-2">
                            <Input
                              value={commentTexts[entry.id] || ""}
                              onChange={(e) => setCommentTexts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              placeholder={t('diary_commentPlaceholder')}
                              className="flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault()
                                  handleAddComment(entry.id)
                                }
                              }}
                            />
                            <Button
                              onClick={() => handleAddComment(entry.id)}
                              disabled={!commentTexts[entry.id]?.trim() || submittingComment === entry.id}
                              className="bg-[#008B8B] hover:bg-[#007070]"
                            >
                              {submittingComment === entry.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-1" />
                              )}
                              {t('diary_saveComment')}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {t('diary_commentsLabel')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
