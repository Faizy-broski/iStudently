'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getSectionResources, recordResourceView, type LearningResource, type ResourceType } from '@/lib/api/learning-resources'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  FolderOpen, Loader2, AlertCircle, ExternalLink, FileText,
  Video, BookOpen, Link2, AlignLeft, Search
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

const TYPE_ICONS: Record<ResourceType, any> = {
  link: Link2,
  book: BookOpen,
  post: AlignLeft,
  file: FileText,
  video: Video,
}

const TYPE_LABELS: Record<ResourceType, string> = {
  link: 'Link',
  book: 'Book',
  post: 'Post',
  file: 'File',
  video: 'Video',
}

const TYPE_COLORS: Record<ResourceType, string> = {
  link: 'bg-blue-100 text-blue-700',
  book: 'bg-amber-100 text-amber-700',
  post: 'bg-purple-100 text-purple-700',
  file: 'bg-green-100 text-green-700',
  video: 'bg-red-100 text-red-700',
}

export default function StudentMaterialsPage() {
  const { profile } = useAuth()
  const sectionId = profile?.section_id
  const studentId = profile?.student_id

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data, isLoading, error } = useSWR(
    sectionId ? ['student-materials', sectionId] : null,
    () => getSectionResources(sectionId!, {}, { limit: 100 }),
    { revalidateOnFocus: false }
  )

  const allResources: LearningResource[] = data?.data || []

  const filtered = allResources.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.subject?.name.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || r.resource_type === typeFilter
    return matchSearch && matchType
  })

  const handleOpen = async (resource: LearningResource) => {
    if (studentId) {
      recordResourceView(resource.id, studentId).catch(() => {})
    }
    const url = resource.url || resource.file_urls?.[0]
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (resource.content) {
      toast.info(resource.content.slice(0, 200))
    } else {
      toast.warning('No link or file attached to this resource')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Learning Materials</h1>
        <p className="text-muted-foreground mt-1">Study resources shared by your teachers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Failed to load materials</p>
          </CardContent>
        </Card>
      ) : !sectionId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No class section assigned to your account</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">
              {allResources.length === 0 ? 'No materials uploaded yet' : 'No results for your filters'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {allResources.length === 0 ? 'Your teachers will upload materials here' : 'Try adjusting your search'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(resource => {
            const Icon = TYPE_ICONS[resource.resource_type] || FileText
            const colorClass = TYPE_COLORS[resource.resource_type] || 'bg-gray-100 text-gray-700'
            const hasLink = !!(resource.url || resource.file_urls?.[0])

            return (
              <Card key={resource.id} className={`hover:shadow-md transition-shadow ${resource.is_pinned ? 'border-primary/40' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight">{resource.title}</p>
                      {resource.subject && (
                        <p className="text-xs text-muted-foreground mt-0.5">{resource.subject.name}</p>
                      )}
                    </div>
                    {resource.is_pinned && (
                      <Badge variant="outline" className="text-xs shrink-0">Pinned</Badge>
                    )}
                  </div>
                  {resource.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{resource.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(resource.created_at), 'MMM d, yyyy')}
                    </span>
                    <Button
                      size="sm"
                      variant={hasLink ? 'default' : 'outline'}
                      className="h-7 text-xs gap-1"
                      onClick={() => handleOpen(resource)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {resource.resource_type === 'video' ? 'Watch' : hasLink ? 'Open' : 'View'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!isLoading && allResources.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Showing {filtered.length} of {allResources.length} material{allResources.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
