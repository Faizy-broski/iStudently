'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as embeddedApi from '@/lib/api/embedded-resources'

interface Props {
  id: string
}

export default function EmbedResourceViewer({ id }: Props) {
  const [resource, setResource] = useState<embeddedApi.EmbeddedResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await embeddedApi.getEmbeddedResourceById(id)
      if (res.success && res.data) {
        setResource(res.data)
      } else {
        setError(res.error || 'Resource not found')
      }
      setLoading(false)
    }
    load()
  }, [id])

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
        <p className="text-lg font-medium">{error || 'Resource not found'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thin header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b shrink-0">
        <h2 className="font-semibold text-gray-800 text-sm">{resource.title}</h2>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>

      {iframeError ? (
        // Shown when the site blocks iframe embedding
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-yellow-500" />
          <div>
            <p className="font-semibold text-gray-700 mb-1">This website cannot be embedded</p>
            <p className="text-sm text-gray-500 mb-4">
              The website at <span className="font-mono text-xs">{resource.url}</span> has blocked
              embedding for security reasons.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Open in new tab instead
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
