'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Globe, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import * as embeddedApi from '@/lib/api/embedded-resources'

interface Props {
  role: 'teacher' | 'student' | 'parent'
  gradeId?: string
}

export default function EmbeddedResourcesList({ role, gradeId }: Props) {
  const [resources, setResources] = useState<embeddedApi.EmbeddedResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await embeddedApi.getEmbeddedResourcesForUser(gradeId)
      if (res.success && res.data) {
        setResources(res.data)
      } else {
        setError(res.error || 'Failed to load resources')
      }
      setLoading(false)
    }
    load()
  }, [gradeId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Globe className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Embedded Resources</h1>
          <p className="text-sm text-gray-500">External websites and tools from your school</p>
        </div>
      </div>

      {resources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No embedded resources available</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Link
              key={r.id}
              href={`/${role}/resources/embedded/${r.id}`}
              className="group flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors shrink-0">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                  {r.title}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{r.url}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
