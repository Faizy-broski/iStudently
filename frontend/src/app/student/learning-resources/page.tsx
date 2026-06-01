"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { toast } from "sonner"
import { 
  Link2, BookOpen, FileText, Video, 
  Loader2, Paperclip, Pin,
  Eye, ExternalLink, Download, Search, Calendar, User,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as learningResourcesApi from "@/lib/api/learning-resources"

type ResourceType = 'link' | 'book' | 'post' | 'file' | 'video'

const resourceTypeConfig = {
  link: { icon: Link2, label: 'Link', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  book: { icon: BookOpen, label: 'Book', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  post: { icon: FileText, label: 'Post', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  file: { icon: Paperclip, label: 'File', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  video: { icon: Video, label: 'Video', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
}

export default function StudentLearningResourcesPage() {
  const { profile } = useAuth()
  
  const [resources, setResources] = useState<learningResourcesApi.LearningResource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResource, setSelectedResource] = useState<learningResourcesApi.LearningResource | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResources, setTotalResources] = useState(0)
  const ITEMS_PER_PAGE = 10
  
  // Filters
  const [filterType, setFilterType] = useState<string>('')
  const [filterSubject, setFilterSubject] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Extract unique subjects from resources
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([])

  // Reload resources when filters or pagination changes
  useEffect(() => {
    if (profile?.section_id) {
      loadResources()
    } else if (profile && !profile.section_id && profile.role === 'student') {
      // Student profile loaded but section_id is missing
      setLoading(false)
      toast.error('Your class section information is not available. Please contact your administrator.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.section_id, currentPage, filterType, filterSubject, debouncedSearch])

  const loadResources = async () => {
    try {
      setLoading(true)
      const filters: Record<string, string> = {}
      if (filterType) filters.resource_type = filterType
      if (filterSubject) filters.subject_id = filterSubject
      if (debouncedSearch) filters.search = debouncedSearch
      
      const result = await learningResourcesApi.getSectionResources(
        profile!.section_id!,
        filters,
        { page: currentPage, limit: ITEMS_PER_PAGE }
      )
      setResources(result.data)
      setTotalPages(result.totalPages)
      setTotalResources(result.total)
      
      // Extract unique subjects for filter dropdown
      const uniqueSubjects = result.data.reduce((acc, r) => {
        if (r.subject && !acc.find(s => s.id === r.subject!.id)) {
          acc.push({ id: r.subject.id, name: r.subject.name })
        }
        return acc
      }, [] as { id: string; name: string }[])
      setSubjects(prev => {
        // Merge with existing subjects to keep all available options
        const merged = [...prev]
        uniqueSubjects.forEach(s => {
          if (!merged.find(m => m.id === s.id)) {
            merged.push(s)
          }
        })
        return merged
      })
    } catch (error) {
      console.error('Error loading resources:', error)
      toast.error('Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  // Reset to first page when filters change
  const handleFilterChange = (type: 'subject' | 'type', value: string) => {
    setCurrentPage(1)
    if (type === 'subject') {
      setFilterSubject(value === 'all' ? '' : value)
    } else {
      setFilterType(value === 'all' ? '' : value)
    }
  }

  const handleOpenResource = async (resource: learningResourcesApi.LearningResource) => {
    // Record view
    if (profile?.student_id) {
      learningResourcesApi.recordResourceView(resource.id, profile.student_id)
    }

    // For posts, show in dialog
    if (resource.resource_type === 'post') {
      setSelectedResource(resource)
      return
    }

    // For links/videos, open in new tab
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer')
      return
    }

    // For files, show in dialog with download links
    if (resource.file_urls && resource.file_urls.length > 0) {
      setSelectedResource(resource)
    }
  }

  const getFileName = (url: string) => {
    const parts = url.split('/')
    return decodeURIComponent(parts[parts.length - 1])
  }

  // Separate pinned and regular resources (server already sends pinned first)
  const pinnedResources = resources.filter(r => r.is_pinned)
  const regularResources = resources.filter(r => !r.is_pinned)

  // Show loading only on initial load
  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show error if section_id is missing
  if (!profile?.section_id) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue dark:text-white">
            Learning Resources
          </h1>
          <p className="text-muted-foreground">
            Access educational materials shared by your teachers
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Section Information Unavailable</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your class section information is not available. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-blue dark:text-white">
          Learning Resources
        </h1>
        <p className="text-muted-foreground">
          Access educational materials shared by your teachers
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterSubject || 'all'} onValueChange={(val) => handleFilterChange('subject', val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(subject => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType || 'all'} onValueChange={(val) => handleFilterChange('type', val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {(Object.keys(resourceTypeConfig) as ResourceType[]).map(type => (
                  <SelectItem key={type} value={type}>
                    {resourceTypeConfig[type].label}
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
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalResources)} of {totalResources} resources
          </span>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {/* Pinned Resources */}
      {pinnedResources.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Pin className="h-4 w-4 text-brand-blue" />
            Pinned Resources
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pinnedResources.map((resource) => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                onOpen={handleOpenResource}
                isPinned
              />
            ))}
          </div>
        </div>
      )}


      {/* All Resources */}
      {regularResources.length > 0 ? (
        <div className="space-y-3">
          {pinnedResources.length > 0 && (
            <h2 className="text-lg font-semibold">All Resources</h2>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {regularResources.map((resource) => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                onOpen={handleOpenResource}
              />
            ))}
          </div>
        </div>
      ) : pinnedResources.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No resources available</p>
            <p className="text-sm text-muted-foreground mt-2">
              {totalResources === 0 && !debouncedSearch && !filterSubject && !filterType
                ? "Your teachers haven't shared any resources yet"
                : 'Try adjusting your filters'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          {/* First Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || loading}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          {/* Previous */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loading}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Page Numbers */}
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
                  className="w-9 h-9"
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                  style={currentPage === pageNum ? { background: 'var(--gradient-blue)' } : undefined}
                >
                  {pageNum}
                </Button>
              )
            })}
          </div>
          
          {/* Next */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || loading}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {/* Last Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || loading}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Resource Detail Dialog */}
      <Dialog open={!!selectedResource} onOpenChange={() => setSelectedResource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedResource && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  {(() => {
                    const config = resourceTypeConfig[selectedResource.resource_type as ResourceType] || resourceTypeConfig.link
                    const Icon = config.icon
                    return (
                      <div className={`p-2 rounded-lg ${config.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    )
                  })()}
                  <div>
                    <DialogTitle className="text-xl" dir="auto">{selectedResource.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>
                        {selectedResource.teacher?.profile?.first_name} {selectedResource.teacher?.profile?.last_name}
                      </span>
                      <span>•</span>
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(selectedResource.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {selectedResource.description && (
                  <p className="text-muted-foreground" dir="auto">{selectedResource.description}</p>
                )}

                {selectedResource.subject && (
                  <Badge variant="outline">{selectedResource.subject.name}</Badge>
                )}

                {/* Post content */}
                {selectedResource.resource_type === 'post' && selectedResource.content && (
                  <div 
                    className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: selectedResource.content }}
                    dir="auto"
                  />
                )}

                {/* Book details */}
                {selectedResource.resource_type === 'book' && (
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    {selectedResource.book_title && (
                      <p><strong>Book:</strong> {selectedResource.book_title}</p>
                    )}
                    {selectedResource.book_author && (
                      <p><strong>Author:</strong> {selectedResource.book_author}</p>
                    )}
                    {selectedResource.book_isbn && (
                      <p><strong>ISBN:</strong> {selectedResource.book_isbn}</p>
                    )}
                    {selectedResource.url && (
                      <Button asChild className="mt-2">
                        <a href={selectedResource.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Book
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {/* File downloads */}
                {selectedResource.file_urls && selectedResource.file_urls.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium">Downloads:</p>
                    {selectedResource.file_urls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          <span className="text-sm">{getFileName(url)}</span>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <a href={url} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {selectedResource.tags && selectedResource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedResource.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Resource Card Component
function ResourceCard({ 
  resource, 
  onOpen,
  isPinned = false
}: { 
  resource: learningResourcesApi.LearningResource
  onOpen: (resource: learningResourcesApi.LearningResource) => void
  isPinned?: boolean
}) {
  const config = resourceTypeConfig[resource.resource_type as ResourceType] || resourceTypeConfig.link
  const Icon = config.icon

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${isPinned ? 'ring-2 ring-brand-blue' : ''}`}
      onClick={() => onOpen(resource)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2" dir="auto">
              {resource.title}
            </CardTitle>
            {resource.subject && (
              <Badge variant="secondary" className="text-xs mt-1">
                {resource.subject.name}
              </Badge>
            )}
          </div>
          {isPinned && <Pin className="h-4 w-4 text-brand-blue flex-shrink-0" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2" dir="auto">
            {resource.description}
          </p>
        )}

        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resource.tags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {resource.teacher?.profile?.first_name} {resource.teacher?.profile?.last_name}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {resource.view_count}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
