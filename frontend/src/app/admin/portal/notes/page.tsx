"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Loader2, Trash2, FileText } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import * as portalApi from "@/lib/api/portal"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { VisibilityPicker, type VisibilityState, type VisibilityMode } from "@/components/portal/visibility-picker"

interface NoteRow {
  id?: string
  title: string
  content: string
  sort_order: number
  file_url: string
  file_name: string
  embed_link: string
  visible_from?: string
  visible_until?: string
  visibility: VisibilityState
  isNew?: boolean
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

export default function PortalNotesPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const getVisibilityMode = (note: portalApi.PortalNote): VisibilityMode => {
    if ((note.visible_to_user_ids?.length ?? 0) > 0) return 'staff'
    return 'roles'
  }

  const fetchNotes = useCallback(async () => {
    if (!profile?.school_id || !selectedCampus?.id) return

    setLoading(true)
    try {
      const result = await portalApi.getNotes({
        campus_id: selectedCampus.id,
        include_inactive: true,
      })

      const mappedNotes: NoteRow[] = result.notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        sort_order: note.sort_order,
        file_url: note.file_url || '',
        file_name: note.file_name || '',
        embed_link: note.embed_link || '',
        visible_from: note.visible_from,
        visible_until: note.visible_until,
        visibility: {
          mode: getVisibilityMode(note),
          roles: note.visible_to_roles || [],
          userIds: note.visible_to_user_ids || [],
          gradeIds: note.visible_to_grade_ids || [],
        },
      }))

      mappedNotes.push(createEmptyRow(mappedNotes.length))
      setNotes(mappedNotes)
    } catch (error) {
      console.error('Error fetching notes:', error)
      toast.error('Failed to load notes')
      setNotes([createEmptyRow(0)])
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedCampus?.id])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const createEmptyRow = (sortOrder: number): NoteRow => ({
    title: '',
    content: '',
    sort_order: sortOrder,
    file_url: '',
    file_name: '',
    embed_link: '',
    visible_from: undefined,
    visible_until: undefined,
    visibility: { mode: 'roles', roles: [], userIds: [], gradeIds: [] },
    isNew: true,
  })

  const updateRow = (index: number, updates: Partial<NoteRow>) => {
    setNotes(notes.map((note, i) =>
      i === index ? { ...note, ...updates } : note
    ))
  }

  const deleteRow = async (index: number) => {
    const note = notes[index]
    if (note.id) {
      try {
        await portalApi.deleteNote(note.id)
        toast.success('Note deleted')
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to delete'
        toast.error(msg)
        return
      }
    }
    const newNotes = notes.filter((_, i) => i !== index)
    if (newNotes.length === 0 || !newNotes[newNotes.length - 1].isNew) {
      newNotes.push(createEmptyRow(newNotes.length))
    }
    setNotes(newNotes)
  }

  const handleSave = async () => {
    if (!selectedCampus?.id) {
      toast.error('Please select a campus first')
      return
    }

    setSaving(true)
    try {
      for (const note of notes) {
        if (!note.title.trim() && !note.content.trim()) continue

        const dto: portalApi.CreateNoteDTO & { visible_to_grade_ids?: string[]; visible_to_user_ids?: string[] } = {
          title: note.title || 'Untitled',
          content: note.content,
          content_type: 'markdown',
          file_url: note.file_url || undefined,
          file_name: note.file_name || undefined,
          embed_link: note.embed_link || undefined,
          sort_order: note.sort_order,
          is_pinned: false,
          visible_from: note.visible_from || undefined,
          visible_until: note.visible_until || undefined,
          visible_to_roles: note.visibility.mode === 'roles' && note.visibility.roles.length > 0
            ? note.visibility.roles
            : ['admin', 'teacher', 'student', 'parent'],
          visible_to_grade_ids: note.visibility.gradeIds,
          visible_to_user_ids: note.visibility.mode !== 'roles' ? note.visibility.userIds : [],
          campus_id: selectedCampus.id,
        }

        if (note.id) {
          await portalApi.updateNote(note.id, dto)
        } else if (note.title.trim() || note.content.trim()) {
          await portalApi.createNote(dto)
        }
      }
      toast.success('Notes saved successfully')
      fetchNotes()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save notes'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!selectedCampus?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Select a Campus</h3>
        <p className="text-muted-foreground">Please select a campus from the top bar to manage notes.</p>
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
          <FileText className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-700">Portal Notes</h1>
      </div>

      {/* Top Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#022172] hover:bg-[#022172]/90"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </Button>
      </div>

      {/* Notes Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <p className="px-4 py-2 text-sm text-gray-500 italic">
            {notes.filter((n) => n.id).length === 0
              ? 'No notes were found.'
              : `${notes.filter((n) => n.id).length} note(s) found.`}
          </p>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_120px_1fr_80px_180px_180px_140px] gap-2 px-4 py-2 bg-gray-50 border-y text-xs font-medium text-gray-600 uppercase tracking-wide">
            <div></div>
            <div>Title</div>
            <div>Note</div>
            <div>Sort Order</div>
            <div>File Attached</div>
            <div>Visible Between</div>
            <div>Visible To</div>
          </div>

          {/* Table Rows */}
          {notes.map((note, index) => (
            <div
              key={note.id || `new-${index}`}
              className="grid grid-cols-[40px_120px_1fr_80px_180px_180px_140px] gap-2 px-4 py-3 border-b items-start"
            >
              {/* Add/Delete Button */}
              <div className="flex items-center pt-1">
                {note.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteRow(index)}
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
                  value={note.title}
                  onChange={(e) => updateRow(index, { title: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              {/* Note Content with Tabs */}
              <div className="p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                <label className="text-xs font-medium text-gray-600 mb-2 block">Note Content</label>
                <Tabs defaultValue="write" className="w-full">
                  <TabsList className="h-7 p-0.5">
                    <TabsTrigger value="write" className="text-xs px-2 h-5 data-[state=active]:bg-white">WRITE</TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs px-2 h-5 data-[state=active]:bg-white">PREVIEW</TabsTrigger>
                    <span className="ml-2 px-1 bg-gray-200 rounded text-xs text-gray-500">M↓</span>
                  </TabsList>
                  <TabsContent value="write" className="mt-1">
                    <Textarea
                      value={note.content}
                      onChange={(e) => updateRow(index, { content: e.target.value })}
                      className="min-h-20 text-sm resize-y border-gray-300"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-1">
                    <div className="min-h-20 p-2 border rounded-md bg-white text-sm whitespace-pre-wrap">
                      {note.content || <span className="text-gray-400 italic">No content</span>}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Sort Order */}
              <div>
                <Input
                  type="number"
                  value={note.sort_order}
                  onChange={(e) => updateRow(index, { sort_order: parseInt(e.target.value) || 0 })}
                  className="h-8 text-sm"
                />
              </div>

              {/* File Attached */}
              <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">File Attached</label>
                  <Input type="file" className="h-7 text-xs border-gray-300" disabled />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Embed Link</label>
                  <Input
                    value={note.embed_link}
                    onChange={(e) => updateRow(index, { embed_link: e.target.value })}
                    placeholder="https://"
                    className="h-7 text-xs border-gray-300"
                  />
                </div>
              </div>

              {/* Visible Between */}
              <div>
                <DateRangePicker
                  from={toDateInput(note.visible_from)}
                  to={toDateInput(note.visible_until)}
                  onFromChange={(v) => updateRow(index, { visible_from: fromDateInput(v) })}
                  onToChange={(v) => updateRow(index, { visible_until: fromDateInput(v) })}
                />
              </div>

              {/* Visible To */}
              <div>
                {profile?.school_id && (
                  <VisibilityPicker
                    value={note.visibility}
                    onChange={(vis: VisibilityState) => updateRow(index, { visibility: vis })}
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
    </div>
  )
}
