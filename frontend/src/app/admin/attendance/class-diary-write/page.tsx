"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Pencil,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Trash2,
  Calendar,
  Save,
  Plus,
  Minus,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Type,
  Upload,
  X,
  FileText,
  Clock,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import * as classDiaryApi from "@/lib/api/class-diary"
import * as timetableApi from "@/lib/api/timetable"
import * as academicsApi from "@/lib/api/academics"
import type { DiaryEntry, CreateDiaryEntryDTO } from "@/lib/api/class-diary"
import type { TimetableEntry } from "@/lib/api/timetable"
import { createClient } from "@/lib/supabase/client"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00")
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
}

function formatEntryTime(timeStr?: string): string {
  if (!timeStr) return ""
  try {
    if (timeStr.includes("T")) {
      return new Date(timeStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    }
    const [h, m, s] = timeStr.split(":")
    const date = new Date()
    date.setHours(parseInt(h), parseInt(m), parseInt(s || "0"))
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return timeStr
  }
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ts
  }
}

// Debounce helper
function debounce(
  func: (content: string) => void,
  wait: number
): ((content: string) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout
  const debounced = (content: string) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(content), wait)
  }
  debounced.cancel = () => clearTimeout(timeout)
  return debounced
}

export default function ClassDiaryWritePage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  // Redirect non-teachers/admins
  const isAdminOrTeacher = profile?.role === "admin" || profile?.role === "super_admin" || profile?.role === "teacher"

  // Academic data
  const { gradeLevels, loading: gradeLevelsLoading } = useGradeLevels()
  const { sections, loading: sectionsLoading } = useSections()

  // Filter state
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedGrade, setSelectedGrade] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedSlot, setSelectedSlot] = useState<string>("") // timetable_entry_id

  // Academic year & timetable
  const [academicYear, setAcademicYear] = useState<academicsApi.AcademicYear | null>(null)
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([])
  const [loadingTimetable, setLoadingTimetable] = useState(false)

  // Editor state
  const editorRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState("")
  const [enableComments, setEnableComments] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null)

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Existing entries
  const [existingEntries, setExistingEntries] = useState<DiaryEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [collapsedEntries, setCollapsedEntries] = useState<Set<string>>(new Set())

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Debounced content update
  const debouncedUpdateContent = useMemo(
    () => debounce((c: string) => setContent(c), 300),
    []
  )

  useEffect(() => {
    return () => debouncedUpdateContent.cancel?.()
  }, [debouncedUpdateContent])

  // Filtered sections by grade
  const filteredSections = useMemo(() => {
    if (!selectedGrade) return []
    return sections.filter(s => s.grade_level_id === selectedGrade && s.is_active)
  }, [sections, selectedGrade])

  // Get timetable slots for selected day
  const daySlots = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    return timetableEntries.filter(e => e.day_of_week === dayOfWeek)
  }, [timetableEntries, selectedDate])

  // Selected timetable entry details
  const selectedTimetableEntry = useMemo(() => {
    if (!selectedSlot) return null
    return daySlots.find(e => e.id === selectedSlot) || null
  }, [daySlots, selectedSlot])

  // Navigate date
  const navigateDate = useCallback((delta: number) => {
    const d = new Date(selectedDate + "T00:00:00")
    d.setDate(d.getDate() + delta)
    const newStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setSelectedDate(newStr)
  }, [selectedDate])

  // Load academic year
  useEffect(() => {
    const loadAcademicYear = async () => {
      try {
        const ay = await academicsApi.getCurrentAcademicYear()
        setAcademicYear(ay)
      } catch {
        console.error("Failed to load academic year")
      }
    }
    loadAcademicYear()
  }, [])

  // Load timetable when section + academic year changes
  useEffect(() => {
    if (!selectedSection || !academicYear?.id) {
      setTimetableEntries([])
      return
    }
    const loadTimetable = async () => {
      setLoadingTimetable(true)
      try {
        const entries = await timetableApi.getTimetableBySection(selectedSection, academicYear.id)
        setTimetableEntries(entries)
      } catch {
        setTimetableEntries([])
      } finally {
        setLoadingTimetable(false)
      }
    }
    loadTimetable()
  }, [selectedSection, academicYear?.id])

  // Load existing entries for the selected date + section
  const loadExistingEntries = useCallback(async () => {
    if (!selectedDate || !selectedSection) {
      setExistingEntries([])
      return
    }
    setLoadingEntries(true)
    try {
      const params: Parameters<typeof classDiaryApi.getDiaryEntries>[0] = {
        diary_date: selectedDate,
        section_id: selectedSection,
        campus_id: selectedCampus?.id,
      }
      const result = await classDiaryApi.getDiaryEntries(params)
      if (result.success && result.data) {
        setExistingEntries(result.data)
      } else {
        setExistingEntries([])
      }
    } catch {
      setExistingEntries([])
    } finally {
      setLoadingEntries(false)
    }
  }, [selectedDate, selectedSection, selectedCampus?.id])

  useEffect(() => {
    loadExistingEntries()
  }, [loadExistingEntries])

  // Reset section/slot when grade changes
  useEffect(() => {
    setSelectedSection("")
    setSelectedSlot("")
  }, [selectedGrade])

  // Reset slot when date changes
  useEffect(() => {
    setSelectedSlot("")
  }, [selectedDate])

  // Execute editor command
  const execCommand = useCallback((command: string, value?: string) => {
    try {
      if (editorRef.current) editorRef.current.focus()
      document.execCommand(command, false, value)
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML
        setContent(newContent)
        debouncedUpdateContent(newContent)
      }
    } catch {
      toast.error("Text formatting failed")
    }
  }, [debouncedUpdateContent])

  // Change text color
  const changeTextColor = useCallback((color: string) => {
    const colorMap: Record<string, string> = {
      black: "#000000", red: "#FF0000", blue: "#0000FF",
      green: "#008000", orange: "#FFA500", purple: "#800080",
    }
    const hexColor = colorMap[color] || color
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand("foreColor", false, hexColor)
    const newContent = editorRef.current.innerHTML
    setContent(newContent)
    debouncedUpdateContent(newContent)
  }, [debouncedUpdateContent])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setPendingFiles(prev => [...prev, ...Array.from(files)])
    e.target.value = ""
  }

  // Remove pending file
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Upload files to Supabase storage and attach to entry
  const uploadAndAttachFiles = async (entryId: string) => {
    if (pendingFiles.length === 0) return
    setUploadingFiles(true)
    const supabase = createClient()
    const schoolId = profile?.school_id || "unknown"
    const campusId = selectedCampus?.id || "general"

    try {
      for (const file of pendingFiles) {
        const timestamp = Date.now()
        const fileExt = file.name.split(".").pop()
        const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${schoolId}/${campusId}/class-diary/${entryId}/${fileName}`

        const { data, error } = await supabase.storage
          .from("Assignments_uploads")
          .upload(filePath, file, { cacheControl: "3600", upsert: false })

        if (error) {
          toast.error(`Failed to upload ${file.name}: ${error.message}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from("Assignments_uploads")
          .getPublicUrl(data.path)

        await classDiaryApi.addDiaryFile(entryId, {
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
        })
      }
      setPendingFiles([])
      toast.success("Files uploaded successfully")
    } catch {
      toast.error("Failed to upload some files")
    } finally {
      setUploadingFiles(false)
    }
  }

  // Remove file from existing entry
  const handleRemoveFile = async (fileId: string, entryId: string) => {
    try {
      const result = await classDiaryApi.removeDiaryFile(fileId)
      if (result.success) {
        setExistingEntries(prev => prev.map(e => {
          if (e.id === entryId) {
            return { ...e, files: (e.files || []).filter(f => f.id !== fileId) }
          }
          return e
        }))
        toast.success("File removed")
      } else {
        toast.error(result.error || "Failed to remove file")
      }
    } catch {
      toast.error("Failed to remove file")
    }
  }

  // Save entry (create or update)
  const handleSave = async () => {
    const editorContent = editorRef.current?.innerHTML || content
    if (!editorContent || editorContent === "<br>" || editorContent.trim() === "") {
      toast.error("Please write some content for the diary entry")
      return
    }

    if (!selectedSection) {
      toast.error("Please select a section")
      return
    }

    setSaving(true)
    try {
      if (editingEntry) {
        // Update existing entry
        const result = await classDiaryApi.updateDiaryEntry(editingEntry.id, {
          content: editorContent,
          enable_comments: enableComments,
        })
        if (result.success) {
          // Upload any pending files
          if (pendingFiles.length > 0) {
            await uploadAndAttachFiles(editingEntry.id)
          }
          toast.success("Diary entry updated successfully")
          clearEditor()
          loadExistingEntries()
        } else {
          toast.error(result.error || "Failed to update entry")
        }
      } else {
        // Create new entry
        const teacherId = selectedTimetableEntry?.teacher_id || profile?.staff_id || profile?.id || ""
        const subjectId = selectedTimetableEntry?.subject_id

        const dto: CreateDiaryEntryDTO = {
          content: editorContent,
          section_id: selectedSection,
          teacher_id: teacherId,
          diary_date: selectedDate,
          day_of_week: getDayOfWeek(selectedDate),
          enable_comments: enableComments,
          campus_id: selectedCampus?.id,
        }

        if (selectedSlot && selectedTimetableEntry) {
          dto.timetable_entry_id = selectedSlot
        }
        if (subjectId) {
          dto.subject_id = subjectId
        }

        // Set entry_time to current time
        const now = new Date()
        dto.entry_time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`

        const result = await classDiaryApi.createDiaryEntry(dto)
        if (result.success && result.data) {
          // Upload any pending files
          if (pendingFiles.length > 0) {
            await uploadAndAttachFiles(result.data.id)
          }
          toast.success("Diary entry created successfully")
          clearEditor()
          loadExistingEntries()
        } else {
          toast.error(result.error || "Failed to create entry")
        }
      }
    } catch {
      toast.error("Failed to save diary entry")
    } finally {
      setSaving(false)
    }
  }

  // Clear the editor
  const clearEditor = () => {
    setContent("")
    setEditingEntry(null)
    setPendingFiles([])
    setEnableComments(true)
    if (editorRef.current) {
      editorRef.current.innerHTML = ""
    }
  }

  // Edit existing entry
  const handleEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry)
    setContent(entry.content)
    setEnableComments(entry.enable_comments)
    if (editorRef.current) {
      editorRef.current.innerHTML = entry.content
    }
    // Scroll to editor
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Delete entry
  const handleDelete = async () => {
    if (!entryToDelete) return
    setDeleting(true)
    try {
      const result = await classDiaryApi.deleteDiaryEntry(entryToDelete)
      if (result.success) {
        toast.success("Diary entry deleted")
        loadExistingEntries()
        if (editingEntry?.id === entryToDelete) {
          clearEditor()
        }
      } else {
        toast.error(result.error || "Failed to delete entry")
      }
    } catch {
      toast.error("Failed to delete entry")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
    }
  }

  // Toggle collapse
  const toggleCollapse = (entryId: string) => {
    setCollapsedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  const dataLoading = gradeLevelsLoading || sectionsLoading

  if (!campusContext) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Access control
  if (!isAdminOrTeacher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <Pencil className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-muted-foreground">Access Restricted</h3>
              <p className="text-sm text-muted-foreground/70">Only teachers and administrators can write diary entries.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Pencil className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Class Diary — Write</h1>
          <p className="text-sm text-muted-foreground">Create and manage diary entries for your classes</p>
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

            {/* Grade */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Grade Level</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade} disabled={dataLoading}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder="Select Grade..." />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Section</label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedGrade || dataLoading}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder="Select Section..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredSections.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Course Period (Timetable Slot) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Course Period</label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot} disabled={!selectedSection || loadingTimetable}>
                <SelectTrigger className="w-62.5">
                  <SelectValue placeholder={loadingTimetable ? "Loading..." : daySlots.length === 0 ? "No slots for this day" : "Select Period..."} />
                </SelectTrigger>
                <SelectContent>
                  {daySlots.map(slot => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.subject_name || "Subject"} — P{slot.period_number || "?"} — {slot.teacher_name || "Teacher"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day info */}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline">{DAY_NAMES[getDayOfWeek(selectedDate)]}</Badge>
            <span className="text-sm text-muted-foreground">{formatDate(selectedDate)}</span>
            {selectedTimetableEntry && (
              <Badge variant="secondary" className="ml-auto">
                {selectedTimetableEntry.subject_name} — {selectedTimetableEntry.teacher_name}
                {selectedTimetableEntry.start_time && ` — ${selectedTimetableEntry.start_time}`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {selectedSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {editingEntry ? (
                <>
                  <Pencil className="h-4 w-4" />
                  Edit Diary Entry
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New Diary Entry
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rich Text Toolbar */}
            <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg border flex-wrap">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("bold")} title="Bold">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("italic")} title="Italic">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("underline")} title="Underline">
                <Underline className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6 mx-2" />

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("insertUnorderedList")} title="Bullet List">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("insertOrderedList")} title="Numbered List">
                <ListOrdered className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6 mx-2" />

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("justifyLeft")} title="Align Left">
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("justifyCenter")} title="Align Center">
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("justifyRight")} title="Align Right">
                <AlignRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("justifyFull")} title="Justify">
                <AlignJustify className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-6 mx-2" />

              <Select onValueChange={changeTextColor}>
                <SelectTrigger className="w-15 h-8 text-xs">
                  <div className="flex items-center gap-1">
                    <Type className="h-3 w-3" />
                    <div className="w-3 h-3 bg-black rounded-sm" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="black">Black</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content Editable Area */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Diary Content
                <span className="text-xs text-muted-foreground ml-2">(Write about what was taught or achieved in class)</span>
              </Label>
              <div
                ref={(el) => {
                  if (el && el !== editorRef.current) {
                    editorRef.current = el
                    if (editingEntry && content) {
                      el.innerHTML = content
                    }
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                className="min-h-50 p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                onInput={(e) => {
                  const c = (e.target as HTMLDivElement).innerHTML
                  setContent(c)
                }}
                onBlur={(e) => {
                  const c = (e.target as HTMLDivElement).innerHTML
                  setContent(c)
                }}
                data-placeholder="Click here to start writing your diary entry..."
              />
            </div>

            {/* File Attachments */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">File Attachments</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>
                {pendingFiles.length > 0 && (
                  <Badge variant="secondary">{pendingFiles.length} file(s) selected</Badge>
                )}
              </div>
              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removePendingFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enable Comments */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-comments-write"
                checked={enableComments}
                onCheckedChange={(checked) => setEnableComments(checked === true)}
              />
              <label htmlFor="enable-comments-write" className="text-sm font-medium cursor-pointer select-none">
                Enable Comments
              </label>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || uploadingFiles}
                className="bg-[#008B8B] hover:bg-[#007070]"
              >
                {saving || uploadingFiles ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingEntry ? "Update Entry" : "Save Entry"}
              </Button>
              {editingEntry && (
                <Button variant="outline" onClick={clearEditor}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Entries for this date/section */}
      {selectedSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Existing Entries for {formatDate(selectedDate)}
              {existingEntries.length > 0 && (
                <Badge variant="secondary">{existingEntries.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : existingEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No entries for this date and section yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {existingEntries.map(entry => {
                  const isCollapsed = collapsedEntries.has(entry.id)
                  const subjectName = entry.subject?.name || "General"
                  const teacherName = entry.teacher?.profile
                    ? `${entry.teacher.profile.first_name || ""} ${entry.teacher.profile.last_name || ""}`.trim()
                    : "—"

                  return (
                    <div key={entry.id} className="border rounded-lg overflow-hidden">
                      {/* Entry Header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatEntryTime(entry.entry_time)}</span>
                          <Badge variant="outline" className="text-xs">{subjectName}</Badge>
                          <span className="text-xs text-muted-foreground">by {teacherName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(entry)}
                            title="Edit Entry"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              setEntryToDelete(entry.id)
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete Entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleCollapse(entry.id)}
                            title={isCollapsed ? "Expand" : "Collapse"}
                          >
                            {isCollapsed ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {/* Entry Content */}
                      {!isCollapsed && (
                        <div className="p-4 space-y-3">
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: entry.content }}
                          />

                          {/* Attached Files */}
                          {entry.files && entry.files.length > 0 && (
                            <div className="space-y-1 pt-2 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Attached Files</p>
                              {entry.files.map(file => (
                                <div key={file.id} className="flex items-center gap-2 text-sm">
                                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                                  <a
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {file.file_name}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleRemoveFile(file.id, entry.id)}
                                    title="Remove file"
                                  >
                                    <X className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Entry meta */}
                          <p className="text-xs text-muted-foreground">
                            Created: {formatTimestamp(entry.created_at)}
                            {entry.enable_comments ? " • Comments enabled" : " • Comments disabled"}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No section selected prompt */}
      {!selectedSection && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <Pencil className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="text-lg font-medium text-muted-foreground">Select a Class</h3>
              <p className="text-sm text-muted-foreground/70">Choose a grade level and section above to start writing diary entries.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Diary Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this diary entry? This action cannot be undone. All attached files and comments will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
