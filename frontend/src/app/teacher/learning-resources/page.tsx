"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { 
  Plus, Link2, BookOpen, FileText, Video, Edit,
  Loader2, Paperclip, X, Upload, Trash2, Pin, PinOff,
  Eye, ExternalLink, Download, Search, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import * as learningResourcesApi from "@/lib/api/learning-resources"
import * as teachersApi from "@/lib/api/teachers"
import { createClient } from "@/lib/supabase/client"

type ResourceType = 'link' | 'book' | 'post' | 'file' | 'video'

const resourceTypeIcons: Record<ResourceType, typeof Link2> = {
  link: Link2,
  book: BookOpen,
  post: FileText,
  file: Paperclip,
  video: Video,
}

const resourceTypeColors: Record<ResourceType, string> = {
  link: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  book: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  post: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  file: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  video: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function LearningResourcesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const t = useTranslations('teacherPages.learningResources')
  const resourceTypeLabels: Record<ResourceType, string> = {
    link: t('typeLink'),
    book: t('typeBook'),
    post: t('typePost'),
    file: t('typeFile'),
    video: t('typeVideo'),
  }
  
  const [resources, setResources] = useState<learningResourcesApi.LearningResource[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [editingResource, setEditingResource] = useState<learningResourcesApi.LearningResource | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResources, setTotalResources] = useState(0)
  const ITEMS_PER_PAGE = 10
  
  // Teacher assignments data
  const [teacherAssignments, setTeacherAssignments] = useState<teachersApi.TeacherSubjectAssignment[]>([])
  const [sections, setSections] = useState<{ id: string; name: string; grade_level?: { name: string } }[]>([])
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])
  
  // Filters
  const [filterSection, setFilterSection] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'link' as ResourceType,
    url: '',
    content: '',
    book_title: '',
    book_author: '',
    book_isbn: '',
    section_id: '',
    subject_id: '',
    tags: '',
    is_pinned: false,
    is_published: true
  })
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [existingFileUrls, setExistingFileUrls] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (profile?.staff_id) {
      loadTeacherData()
    }
  }, [profile?.staff_id])

  // Reload resources when filters or pagination changes
  useEffect(() => {
    if (profile?.staff_id) {
      loadResources()
    }
  }, [profile?.staff_id, currentPage, filterSection, filterType, debouncedSearch])

  const loadTeacherData = async () => {
    try {
      const assignments = await teachersApi.getTeacherAssignments(profile!.staff_id!)
      setTeacherAssignments(assignments)
      
      // Extract unique sections
      const uniqueSections = assignments.reduce((acc, a) => {
        if (a.section && !acc.find(s => s.id === a.section!.id)) {
          acc.push({
            id: a.section.id,
            name: a.section.name,
            grade_level: a.section.grade_level
          })
        }
        return acc
      }, [] as { id: string; name: string; grade_level?: { name: string } }[])
      setSections(uniqueSections)
      
      // Extract unique subjects
      const uniqueSubjects = assignments.reduce((acc, a) => {
        if (a.subject && !acc.find(s => s.id === a.subject!.id)) {
          acc.push({ id: a.subject.id, name: a.subject.name })
        }
        return acc
      }, [] as { id: string; name: string }[])
      setSubjects(uniqueSubjects)
    } catch (error) {
      console.error('Error loading teacher data:', error)
    }
  }

  const loadResources = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (filterSection) filters.section_id = filterSection
      if (filterType) filters.resource_type = filterType
      if (debouncedSearch) filters.search = debouncedSearch
      
      const result = await learningResourcesApi.getTeacherResources(
        profile!.staff_id!,
        filters,
        { page: currentPage, limit: ITEMS_PER_PAGE }
      )
      setResources(result.data)
      setTotalPages(result.totalPages)
      setTotalResources(result.total)
    } catch (error: any) {
      console.error('Error loading resources:', error)
      toast.error(t('loadResourcesError'))
    } finally {
      setLoading(false)
    }
  }

  // Upload files to Supabase storage
  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const supabase = createClient()
    const uploadedUrls: string[] = []

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.staff_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('learning-resources')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        throw new Error(`Failed to upload ${file.name}: ${error.message}`)
      }

      const { data: urlData } = supabase.storage
        .from('learning-resources')
        .getPublicUrl(data.path)

      uploadedUrls.push(urlData.publicUrl)
    }

    return uploadedUrls
  }

  const handleSubmit = async () => {
    if (submitting) return

    if (!formData.title.trim()) {
      toast.error(t('enterTitleError'))
      return
    }

    if (!formData.section_id) {
      toast.error(t('selectSectionError'))
      return
    }

    try {
      setSubmitting(true)

      let fileUrls: string[] = []
      if (formData.resource_type === 'file' && uploadedFiles.length > 0) {
        setUploadingFiles(true)
        try {
          fileUrls = await uploadFilesToStorage(uploadedFiles)
        } catch (uploadError: any) {
          toast.error(uploadError.message || t('uploadFilesError'))
          return
        } finally {
          setUploadingFiles(false)
        }
      }

      // Get academic year from teacher assignments
      const assignment = teacherAssignments.find(a => a.section?.id === formData.section_id)
      
      // Combine existing file URLs with newly uploaded ones
      const allFileUrls = [...existingFileUrls, ...fileUrls]

      const dto: learningResourcesApi.CreateResourceDTO = {
        school_id: profile!.school_id!,
        campus_id: profile!.campus_id,
        academic_year_id: assignment?.academic_year_id || teacherAssignments[0]?.academic_year_id || '',
        teacher_id: profile!.staff_id!,
        section_id: formData.section_id,
        subject_id: formData.subject_id || undefined,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        resource_type: formData.resource_type,
        url: formData.url.trim() || undefined,
        content: formData.resource_type === 'post' ? (contentRef.current?.innerHTML || formData.content) : undefined,
        file_urls: allFileUrls.length > 0 ? allFileUrls : undefined,
        book_title: formData.book_title.trim() || undefined,
        book_author: formData.book_author.trim() || undefined,
        book_isbn: formData.book_isbn.trim() || undefined,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        is_pinned: formData.is_pinned,
        is_published: formData.is_published
      }

      if (editingResource) {
        // Update existing resource
        await learningResourcesApi.updateResource(editingResource.id, dto)
        toast.success(t('resourceUpdatedSuccess'))
      } else {
        // Create new resource
        await learningResourcesApi.createResource(dto)
        toast.success(t('resourceSharedSuccess'))
      }
      setIsDialogOpen(false)
      resetForm()
      loadResources()
    } catch (error: any) {
      console.error('Error saving resource:', error)
      toast.error(error.message || t('saveResourceError'))
    } finally {
      setSubmitting(false)
      setUploadingFiles(false)
    }
  }

  const handleDelete = async (resourceId: string) => {
    try {
      await learningResourcesApi.deleteResource(resourceId)
      toast.success(t('resourceDeleted'))
      loadResources()
    } catch (error: any) {
      toast.error(error.message || t('deleteResourceError'))
    }
  }

  const handleTogglePin = async (resource: learningResourcesApi.LearningResource) => {
    try {
      await learningResourcesApi.updateResource(resource.id, { is_pinned: !resource.is_pinned })
      toast.success(resource.is_pinned ? t('unpinned') : t('pinned'))
      loadResources()
    } catch (error: any) {
      toast.error(error.message || t('updateResourceError'))
    }
  }

  const handleTogglePublish = async (resource: learningResourcesApi.LearningResource) => {
    try {
      await learningResourcesApi.updateResource(resource.id, { is_published: !resource.is_published })
      toast.success(resource.is_published ? t('unpublished') : t('published'))
      loadResources()
    } catch (error: any) {
      toast.error(error.message || t('updateResourceError'))
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      resource_type: 'link',
      url: '',
      content: '',
      book_title: '',
      book_author: '',
      book_isbn: '',
      section_id: '',
      subject_id: '',
      tags: '',
      is_pinned: false,
      is_published: true
    })
    setUploadedFiles([])
    setExistingFileUrls([])
    setEditingResource(null)
    if (contentRef.current) {
      contentRef.current.innerHTML = ''
    }
  }

  const handleEdit = (resource: learningResourcesApi.LearningResource) => {
    setEditingResource(resource)
    setFormData({
      title: resource.title,
      description: resource.description || '',
      resource_type: resource.resource_type as ResourceType,
      url: resource.url || '',
      content: resource.content || '',
      book_title: resource.book_title || '',
      book_author: resource.book_author || '',
      book_isbn: resource.book_isbn || '',
      section_id: resource.section_id || '',
      subject_id: resource.subject_id || '',
      tags: resource.tags?.join(', ') || '',
      is_pinned: resource.is_pinned,
      is_published: resource.is_published
    })
    // Set existing file URLs
    setExistingFileUrls(resource.file_urls || [])
    // Set content for post type
    if (resource.resource_type === 'post' && resource.content && contentRef.current) {
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.innerHTML = resource.content || ''
        }
      }, 100)
    }
    setIsDialogOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const maxSize = 25 * 1024 * 1024 // 25MB
      if (file.size > maxSize) {
        toast.error(t('fileTooLargeError', { fileName: file.name }))
        return false
      }
      return true
    })
    setUploadedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Detect text direction
  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
    const firstChar = text.replace(/<[^>]*>/g, '').trim().charAt(0)
    return rtlChars.test(firstChar) ? 'rtl' : 'ltr'
  }

  // Reset to first page when filters change
  const handleFilterChange = (type: 'section' | 'type', value: string) => {
    setCurrentPage(1)
    if (type === 'section') {
      setFilterSection(value === 'all' ? '' : value)
    } else {
      setFilterType(value === 'all' ? '' : value)
    }
  }

  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue dark:text-white">
            {t('pageTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button
              style={{ background: 'var(--gradient-blue)' }}
              className="text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('shareResource')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingResource ? t('editResource') : t('shareNewResource')}</DialogTitle>
              <DialogDescription>
                {editingResource ? t('updateResourceDescription') : t('shareResourceDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Resource Type Tabs */}
              <div>
                <Label>{t('resourceType')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(Object.keys(resourceTypeIcons) as ResourceType[]).map(type => {
                    const Icon = resourceTypeIcons[type]
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={formData.resource_type === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFormData({ ...formData, resource_type: type })}
                        className={formData.resource_type === type ? '' : ''}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {resourceTypeLabels[type]}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title">{t('titleField')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('titlePlaceholder')}
                  dir="auto"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">{t('description')}</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[80px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('descriptionPlaceholder')}
                  dir="auto"
                />
              </div>

              {/* Section & Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('sectionField')}</Label>
                  <Select
                    value={formData.section_id}
                    onValueChange={(val) => setFormData({ ...formData, section_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectSectionPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map(section => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.grade_level?.name} - {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('subjectFieldOptional')}</Label>
                  <Select
                    value={formData.subject_id || 'all'}
                    onValueChange={(val) => setFormData({ ...formData, subject_id: val === 'all' ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('allSubjects')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allSubjects')}</SelectItem>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Type-specific fields */}
              {(formData.resource_type === 'link' || formData.resource_type === 'video') && (
                <div>
                  <Label htmlFor="url">{t('urlField')}</Label>
                  <Input
                    id="url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={formData.resource_type === 'video' ? 'https://youtube.com/...' : 'https://...'}
                  />
                </div>
              )}

              {formData.resource_type === 'book' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="book_title">{t('bookTitle')}</Label>
                    <Input
                      id="book_title"
                      value={formData.book_title}
                      onChange={(e) => setFormData({ ...formData, book_title: e.target.value })}
                      placeholder={t('bookTitle')}
                      dir="auto"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="book_author">{t('author')}</Label>
                      <Input
                        id="book_author"
                        value={formData.book_author}
                        onChange={(e) => setFormData({ ...formData, book_author: e.target.value })}
                        placeholder={t('authorNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="book_isbn">{t('isbnOptional')}</Label>
                      <Input
                        id="book_isbn"
                        value={formData.book_isbn}
                        onChange={(e) => setFormData({ ...formData, book_isbn: e.target.value })}
                        placeholder={t('isbn')}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="book_url">{t('purchaseLinkOptional')}</Label>
                    <Input
                      id="book_url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              {formData.resource_type === 'post' && (
                <div>
                  <Label>{t('content')}</Label>
                  <div className="border rounded-lg overflow-hidden mt-2">
                    <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 font-bold"
                        onClick={() => document.execCommand('bold')}
                      >
                        B
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 italic"
                        onClick={() => document.execCommand('italic')}
                      >
                        I
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => document.execCommand('underline')}
                      >
                        <span className="underline">U</span>
                      </Button>
                      <div className="w-px h-6 bg-border mx-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          if (contentRef.current) {
                            contentRef.current.dir = 'ltr'
                            contentRef.current.style.textAlign = 'left'
                          }
                        }}
                      >
                        {t('ltr')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          if (contentRef.current) {
                            contentRef.current.dir = 'rtl'
                            contentRef.current.style.textAlign = 'right'
                          }
                        }}
                      >
                        {t('rtl')}
                      </Button>
                    </div>
                    <div
                      ref={contentRef}
                      contentEditable
                      className="min-h-[200px] p-3 focus:outline-none"
                      onInput={(e) => {
                        const text = e.currentTarget.textContent || ''
                        if (text.length === 1) {
                          const dir = detectTextDirection(text)
                          e.currentTarget.dir = dir
                          e.currentTarget.style.textAlign = dir === 'rtl' ? 'right' : 'left'
                        }
                        setFormData({ ...formData, content: e.currentTarget.innerHTML })
                      }}
                      style={{ whiteSpace: 'pre-wrap' }}
                      dir="auto"
                    />
                  </div>
                </div>
              )}

              {formData.resource_type === 'file' && (
                <div>
                  <Label>{t('files')}</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 hover:border-brand-blue transition-colors mt-2">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <div className="text-center">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <span className="text-sm font-medium text-brand-blue hover:underline">
                            {t('clickToUploadFiles')}
                          </span>
                          <input
                            id="file-upload"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                          />
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('fileTypesHint')}
                        </p>
                      </div>
                    </div>

                    {/* Existing files from database */}
                    {existingFileUrls.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('existingFiles')}</p>
                        {existingFileUrls.map((url, index) => {
                          const fileName = decodeURIComponent(url.split('/').pop() || t('fileFallbackName'))
                          return (
                            <div key={`existing-${index}`} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-green-600" />
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-green-700 dark:text-green-400 hover:underline"
                                >
                                  {fileName}
                                </a>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setExistingFileUrls(prev => prev.filter((_, i) => i !== index))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* New files to upload */}
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('newFilesToUpload')}</p>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              <Paperclip className="h-4 w-4" />
                              <span className="text-sm">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <Label htmlFor="tags">{t('tagsField')}</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('tagsPlaceholder')}
                />
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_pinned}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
                  />
                  <Label>{t('pinToTop')}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <Label>{t('publishImmediately')}</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploadingFiles}
                style={{ background: 'var(--gradient-blue)' }}
                className="text-white"
              >
                {submitting || uploadingFiles ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadingFiles ? t('uploading') : t('saving')}
                  </>
                ) : (
                  editingResource ? t('updateResource') : t('shareResource')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchResourcesPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterSection || 'all'} onValueChange={(val) => handleFilterChange('section', val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('allSections')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allSections')}</SelectItem>
                {sections.map(section => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.grade_level?.name} - {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType || 'all'} onValueChange={(val) => handleFilterChange('type', val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes')}</SelectItem>
                {(Object.keys(resourceTypeIcons) as ResourceType[]).map(type => (
                  <SelectItem key={type} value={type}>
                    {resourceTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results info */}
      {totalResources > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('showingRange', {
              from: ((currentPage - 1) * ITEMS_PER_PAGE) + 1,
              to: Math.min(currentPage * ITEMS_PER_PAGE, totalResources),
              total: totalResources,
            })}
          </span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {/* Resources Grid */}
      {resources.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => {
            const resourceType = (resource.resource_type as ResourceType) in resourceTypeIcons ? (resource.resource_type as ResourceType) : 'link'
            const Icon = resourceTypeIcons[resourceType]
            const colorClass = resourceTypeColors[resourceType]

            return (
              <Card key={resource.id} className={`relative ${resource.is_pinned ? 'ring-2 ring-brand-blue' : ''}`}>
                {resource.is_pinned && (
                  <div className="absolute top-2 right-2">
                    <Pin className="h-4 w-4 text-brand-blue" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2" dir="auto">
                        {resource.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {resource.section?.grade_level?.name} - {resource.section?.name}
                        </Badge>
                        {!resource.is_published && (
                          <Badge variant="outline" className="text-xs">{t('draft')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resource.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2" dir="auto">
                      {resource.description}
                    </p>
                  )}
                  
                  {resource.subject && (
                    <Badge variant="outline" className="text-xs">
                      {resource.subject.name}
                    </Badge>
                  )}

                  {resource.tags && resource.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {resource.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {resource.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{resource.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {t('viewsCount', { count: resource.view_count })}
                    </span>
                    <span>
                      {new Date(resource.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    {resource.url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        asChild
                      >
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {t('open')}
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(resource)}
                      title={t('edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePin(resource)}
                      title={resource.is_pinned ? t('unpin') : t('pin')}
                    >
                      {resource.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePublish(resource)}
                      title={resource.is_published ? t('unpublish') : t('publish')}
                    >
                      <Eye className={`h-4 w-4 ${!resource.is_published ? 'text-muted-foreground' : ''}`} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('deleteResourceTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteResourceDescription')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(resource.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            {t('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">{t('noResourcesFound')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {totalResources === 0 && !debouncedSearch && !filterSection && !filterType
                ? t('shareFirstResourceHint')
                : t('adjustFiltersHint')}
            </p>
            {totalResources === 0 && !debouncedSearch && !filterSection && !filterType && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="mt-4"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('shareResource')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || loading}
            title={t('firstPage')}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
            title={t('previousPage')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  style={currentPage === pageNum ? { background: 'var(--gradient-blue)' } : undefined}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || loading}
            title={t('nextPage')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || loading}
            title={t('lastPage')}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
