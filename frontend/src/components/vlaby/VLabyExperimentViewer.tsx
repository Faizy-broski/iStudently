'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FlaskConical, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getVLabyExperiment,
  getStoredVLabyToken,
  clearVLabyToken,
  type VLabyExperimentDetail,
} from '@/lib/api/vlaby'

interface VLabyExperimentViewerProps {
  experimentId: string | number
  /** Back href, e.g. /admin/resources/vlaby */
  backPath: string
  /** If no token, redirect to this path for login */
  loginPath: string
}

export default function VLabyExperimentViewer({
  experimentId,
  backPath,
  loginPath,
}: VLabyExperimentViewerProps) {
  const router = useRouter()
  const [experiment, setExperiment] = useState<VLabyExperimentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getStoredVLabyToken()
    if (!token) {
      router.replace(loginPath)
      return
    }

    let cancelled = false

    const load = async () => {
      const res = await getVLabyExperiment(experimentId)
      if (cancelled) return
      setLoading(false)

      if (!res.success) {
        if (res.code === 'VLABY_TOKEN_EXPIRED') {
          clearVLabyToken()
          toast.error('VLaby session expired. Please log in again.')
          router.replace(loginPath)
          return
        }
        setError(res.error || 'Failed to load experiment')
        return
      }

      setExperiment(res.data?.experiment ?? null)
    }

    load()
    return () => { cancelled = true }
  }, [experimentId, loginPath, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh] gap-2 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        Loading experiment…
      </div>
    )
  }

  if (error || !experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4">
        <p className="text-red-500">{error || 'Experiment not found'}</p>
        <Button variant="outline" onClick={() => router.push(backPath)}>
          <ArrowLeft size={14} className="mr-1" /> Back to experiments
        </Button>
      </div>
    )
  }

  const hasIframe = Boolean(experiment.file)

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push(backPath)} className="gap-1 text-gray-500">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2 font-semibold text-gray-800 text-base">
          <FlaskConical size={18} className="text-indigo-600" />
          {experiment.title}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
        <Badge variant="secondary">{experiment.subject_name}</Badge>
        {experiment.points > 0 && <Badge variant="outline">{experiment.points} pts</Badge>}
        <span>·</span>
        <span>{experiment.country_name}</span>
        <span>·</span>
        <span>{experiment.level_name} — {experiment.level_class_name} — {experiment.semester_name}</span>
        {experiment.file && (
          <a
            href={experiment.file}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-indigo-600 hover:underline text-xs"
          >
            Open in new tab <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Iframe */}
      {hasIframe ? (
        <div className="rounded-xl overflow-hidden border shadow-sm" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
          <iframe
            src={experiment.file}
            title={experiment.title}
            className="w-full h-full"
            allow="fullscreen"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 border rounded-xl bg-gray-50 text-gray-400">
          No interactive file available for this experiment.
        </div>
      )}

      {/* Description */}
      {experiment.description && (
        <div className="prose prose-sm max-w-none text-gray-600 border rounded-xl p-4 bg-white">
          <p>{experiment.description}</p>
        </div>
      )}
    </div>
  )
}
