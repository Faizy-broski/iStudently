'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Link2, ExternalLink } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import useSWR from 'swr'
import { getResourceLinks, type ResourceLink } from '@/lib/api/resource-links'

export default function TeacherResourceLinksPage() {
  useAuth()

  const { data: links, isLoading } = useSWR(
    'teacher-resource-links',
    () => getResourceLinks(),
    { revalidateOnFocus: false }
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
          <Link2 className="h-7 w-7" />
          Resources
        </h1>
        <p className="text-muted-foreground mt-1">
          Useful links and resources provided by your school.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : `${(links || []).length} resource${(links || []).length !== 1 ? 's' : ''} available.`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (links || []).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No resources available at this time.
            </p>
          ) : (
            <div className="space-y-2">
              {(links || []).map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent hover:border-[#008B8B] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-[#008B8B]" />
                    <div>
                      <p className="font-medium text-blue-600 group-hover:underline">
                        {link.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {link.url}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
