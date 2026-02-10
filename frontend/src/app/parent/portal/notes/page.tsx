"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Pin, Download, ExternalLink, ArrowLeft, Calendar } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useParentDashboardSafe } from "@/context/ParentDashboardContext"
import * as portalApi from "@/lib/api/portal"
import { formatDistanceToNow, format } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { markPortalItemViewed } from "@/lib/utils/portal-storage"

export default function ParentPortalNotesPage() {
  const { profile } = useAuth()
  const parentDashboard = useParentDashboardSafe()
  const [notes, setNotes] = useState<portalApi.PortalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  // Use selected student's campus for filtering
  const selectedStudentCampus = parentDashboard?.selectedStudentData?.campus_id

  const fetchNotes = useCallback(async () => {
    if (!profile?.school_id || !selectedStudentCampus) {
      console.log('📝 Parent notes: Missing campus info', { 
        schoolId: profile?.school_id, 
        selectedStudentCampus 
      })
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const result = await portalApi.getNotes({ campus_id: selectedStudentCampus, limit: 100 })
      setNotes(result.notes)
      result.notes.forEach(note => markPortalItemViewed('note', note.id))
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedStudentCampus])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4 mb-6"><Skeleton className="h-10 w-10" /><Skeleton className="h-8 w-48" /></div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/parent/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">Announcements</h1>
          <p className="text-muted-foreground">All school announcements and notices</p>
        </div>
      </div>

      {notes.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Announcements</h3>
          <p className="text-muted-foreground">There are no announcements at this time.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id} className={cn("cursor-pointer transition-all hover:shadow-md", note.is_pinned && "border-[#022172] border-2")} onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {note.is_pinned && <Pin className="h-5 w-5 text-[#022172] mt-0.5" />}
                    <div>
                      <CardTitle className="text-lg">{note.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                        <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  {note.is_pinned && <Badge className="bg-[#022172]">Pinned</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn("prose prose-sm max-w-none", expandedNote !== note.id && "line-clamp-3")}>
                  <p className="whitespace-pre-wrap">{note.content}</p>
                </div>
                {expandedNote === note.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {note.file_url && <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#022172] hover:underline" onClick={(e) => e.stopPropagation()}><Download className="h-4 w-4" />{note.file_name || 'Download Attachment'}</a>}
                    {note.embed_link && <a href={note.embed_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#022172] hover:underline" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" />View Link</a>}
                  </div>
                )}
                {expandedNote !== note.id && note.content.length > 200 && <Button variant="link" className="p-0 h-auto mt-2 text-[#022172]">Read more...</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
