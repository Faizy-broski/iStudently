'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { getSchoolReadingLogs, type ReadingLog } from '@/lib/api/reading-logs'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  BookOpen, Search, Loader2, Calendar, FileText,
  Clock, MicOff, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

function AudioSection({ log }: { log: ReadingLog }) {
  const ageInDays = differenceInDays(new Date(), parseISO(log.created_at))
  const expired = ageInDays > 14

  if (!log.audio_file_path && !log.audio_url) return null

  if (expired) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MicOff className="h-3.5 w-3.5" />
        <span>Audio Expired (14-day limit reached)</span>
      </div>
    )
  }

  if (log.audio_url) {
    return (
      <div className="mt-2 space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Audio ({14 - ageInDays} day{14 - ageInDays !== 1 ? 's' : ''} remaining)
        </p>
        <audio controls src={log.audio_url} className="w-full h-9" />
      </div>
    )
  }

  return null
}

function LogRow({ log }: { log: ReadingLog }) {
  const [expanded, setExpanded] = useState(false)
  const student = log.student
  const ageInDays = differenceInDays(new Date(), parseISO(log.created_at))
  const hasAudio = !!log.audio_url && ageInDays <= 14

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Avatar */}
          <Avatar className="h-9 w-9 shrink-0">
            {student?.profile_image && <AvatarImage src={student.profile_image} />}
            <AvatarFallback className="text-xs">
              {student ? initials(student.first_name, student.last_name) : '??'}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-semibold text-sm">
                {student ? `${student.first_name} ${student.last_name}` : 'Unknown'}
              </p>
              <div className="flex gap-1.5">
                {hasAudio && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-600">
                    🎙 Audio
                  </Badge>
                )}
                {log.audio_file_path && ageInDays > 14 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    Audio Expired
                  </Badge>
                )}
              </div>
            </div>

            {/* Book info */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{log.book_title}</span>
              {log.book_author && (
                <span className="text-xs text-muted-foreground truncate">— {log.book_author}</span>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(log.session_date), 'MMM d, yyyy')}
              </span>
              {log.pages_read != null && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {log.pages_read} pages
                </span>
              )}
            </div>

            {/* Notes toggle */}
            {log.notes && (
              <>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expanded ? 'Hide notes' : 'View notes'}
                </button>
                {expanded && (
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{log.notes}</p>
                )}
              </>
            )}

            <AudioSection log={log} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TeacherReadingLogsPage() {
  const [logs, setLogs] = useState<ReadingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getSchoolReadingLogs().then(res => {
      if (res.success) setLogs(res.data ?? [])
      else console.error('[ReadingLogs]', res.error)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return logs
    return logs.filter(log => {
      const name = log.student
        ? `${log.student.first_name} ${log.student.last_name}`.toLowerCase()
        : ''
      return (
        name.includes(q) ||
        log.book_title.toLowerCase().includes(q) ||
        (log.book_author?.toLowerCase() ?? '').includes(q)
      )
    })
  }, [logs, search])

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Student Reading Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review reading sessions submitted by students. Audio recordings expire after 14 days.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by student name, book title or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
          {search && <span>filtered from {logs.length} total</span>}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {search ? 'No sessions match your search.' : 'No reading sessions logged yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  )
}
