'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as embeddedApi from '@/lib/api/embedded-resources'
import { useCampus } from '@/context/CampusContext'

interface Props {
  id: string
}

export default function EmbedResourceViewer({ id }: Props) {
  const t = useTranslations('teacherPages.resourcesEmbeddedDetail')
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [resource, setResource] = useState<embeddedApi.EmbeddedResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await embeddedApi.getEmbeddedResourceById(id, campusId)
      if (res.success && res.data) {
        setResource(res.data)
      } else {
        setError(res.error || t('resourceNotFound'))
      }
      setLoading(false)
    }
    load()
  }, [id, campusId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !resource) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-gray-500">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
        <p className="text-lg font-medium">{error || t('resourceNotFound')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thin header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b shrink-0">
        <h2 className="font-semibold text-gray-800 text-sm">{resource.title}</h2>
        {/* Always available, not just on the cannotBeEmbedded fallback below — some sites
            embed fine themselves but block specific in-page links/downloads (e.g. a PDF
            with its own frame-ancestors restriction) once clicked from inside the iframe.
            That failure is invisible to us (iframe onError doesn't fire for it), so users
            need a standing way to escape to a real tab where every link on the site works. */}
        <Button asChild variant="outline" size="sm">
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            {t('openInNewTab')}
          </a>
        </Button>
      </div>

      {iframeError ? (
        // Shown when the site blocks iframe embedding
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-yellow-500" />
          <div>
            <p className="font-semibold text-gray-700 mb-1">{t('cannotBeEmbedded')}</p>
            <p className="text-sm text-gray-500 mb-4">
              {t.rich('blockedForSecurity', {
                url: (chunks) => <span className="font-mono text-xs">{chunks}</span>,
                siteUrl: resource.url,
              })}
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                {t('openInNewTabInstead')}
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <iframe
          src={resource.url}
          title={resource.title}
          className="flex-1 w-full border-0"
          style={{ height: 'calc(100vh - 112px)' }}
          onError={() => setIframeError(true)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  )
}
