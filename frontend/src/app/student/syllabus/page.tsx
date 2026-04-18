'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getSectionResources, type LearningResource } from '@/lib/api/learning-resources'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, Loader2, AlertCircle, ExternalLink, FileText, Link2, Video, AlignLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function StudentSyllabusPage() {
  const { profile } = useAuth()
  const sectionId = profile?.section_id

  const { data, isLoading } = useSWR(
    sectionId ? ['student-syllabus', sectionId] : null,
    () => getSectionResources(sectionId!, {}, { limit: 200 }),
    { revalidateOnFocus: false }
  )

  const allResources: LearningResource[] = data?.data || []

  // Group by subject (syllabus view = resources organized by subject)
  const bySubject = allResources.reduce<Record<string, { name: string; resources: LearningResource[] }>>(
    (acc, r) => {
      const key = r.subject?.id || 'general'
      const name = r.subject?.name || 'General'
      if (!acc[key]) acc[key] = { name, resources: [] }
      acc[key].resources.push(r)
      return acc
    },
    {}
  )

  const subjects = Object.values(bySubject).sort((a, b) => a.name.localeCompare(b.name))

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return Video
      case 'link': return Link2
      case 'book': return BookOpen
      case 'post': return AlignLeft
      default: return FileText
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Syllabus</h1>
        <p className="text-muted-foreground mt-1">Course outlines and resources organized by subject</p>
      </div>

      {!sectionId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No class section assigned to your account</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">No syllabus materials yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your teachers will upload course materials here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {subjects.map(subject => (
            <Card key={subject.name}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {subject.name}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {subject.resources.length} item{subject.resources.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {subject.resources.map(r => {
                    const Icon = getIcon(r.resource_type)
                    const url = r.url || r.file_urls?.[0]
                    return (
                      <div
                        key={r.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{r.title}</p>
                            {r.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(r.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        {url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 shrink-0"
                            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
