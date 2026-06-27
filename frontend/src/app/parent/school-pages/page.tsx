'use client'

import { useEffect, useState } from 'react'
import { getMyPages, type CustomLink } from '@/lib/api/public-pages'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, FileText, Image as ImageIcon, Code2, Link2 } from 'lucide-react'

function PageCard({ page }: { page: CustomLink }) {
  if (page.page_type === 'url') {
    return (
      <a href={page.url} target="_blank" rel="noopener noreferrer">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="flex items-center gap-3 p-4">
            <Link2 className="h-5 w-5 text-primary shrink-0" />
            <span className="font-medium text-sm flex-1">{page.title}</span>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </a>
    )
  }

  if (page.page_type === 'embed') {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Code2 className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm">{page.title}</span>
          </div>
          <iframe
            src={page.url}
            className="w-full rounded-b-lg"
            style={{ height: 480, border: 'none' }}
            title={page.title}
          />
        </CardContent>
      </Card>
    )
  }

  if (page.page_type === 'text') {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm">{page.title}</span>
          </div>
          <div
            className="prose prose-sm max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: page.content ?? '' }}
          />
        </CardContent>
      </Card>
    )
  }

  if (page.page_type === 'image') {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-sm">{page.title}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.image_url}
            alt={page.title}
            className="w-full object-contain max-h-[600px]"
          />
        </CardContent>
      </Card>
    )
  }

  return null
}

export default function SchoolPagesPage() {
  const [pages, setPages] = useState<CustomLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyPages()
      .then(res => { if (res.success) setPages(res.data ?? []) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">School Pages</h1>
        <p className="text-sm text-muted-foreground mt-1">Resources and information shared by your school.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No pages published yet.
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map(p => <PageCard key={p.id} page={p} />)}
        </div>
      )}
    </div>
  )
}
