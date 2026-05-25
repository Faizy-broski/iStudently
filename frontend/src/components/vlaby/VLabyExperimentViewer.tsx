'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FlaskConical, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  getVLabyExperiment,
  type VLabyExperimentDetail,
} from '@/lib/api/vlaby'

interface VLabyExperimentViewerProps {
  experimentId: string | number
  /** Back href, e.g. /admin/resources/vlaby */
  backPath: string
}

export default function VLabyExperimentViewer({
  experimentId,
  backPath,
}: VLabyExperimentViewerProps) {
  const router = useRouter()
  const [experiment, setExperiment] = useState<VLabyExperimentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noAccount, setNoAccount] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const res = await getVLabyExperiment(experimentId)
      if (cancelled) return
      setLoading(false)

      if (!res.success) {
        if ((res as any).code === 'VLABY_TOKEN_REQUIRED') {
          setNoAccount(true)
        } else {
          setError(res.error || 'Failed to load experiment')
        }
        return
      }

      setExperiment(res.data?.experiment ?? null)
    }

    load()
    return () => { cancelled = true }
  }, [experimentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh] gap-2 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        Loading experiment…
      </div>
    )
  }

  if (noAccount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 text-center px-4">
        <AlertCircle size={40} className="text-amber-400" />
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">No VLaby account connected</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Ask your school administrator to connect the school's VLaby account so experiments can be opened.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(backPath)}>
          <ArrowLeft size={14} className="mr-1 rtl:rotate-180 rtl:ml-1 rtl:mr-0" /> Back to experiments
        </Button>
      </div>
    )
  }

  if (error || !experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4">
        <p className="text-red-500">{error || 'Experiment not found'}</p>
        <Button variant="outline" onClick={() => router.push(backPath)}>
          <ArrowLeft size={14} className="mr-1 rtl:rotate-180 rtl:ml-1 rtl:mr-0" /> Back to experiments
        </Button>
      </div>
    )
  }

  const hasIframe = Boolean(experiment.file)

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push(backPath)} className="gap-1 text-gray-500 dark:text-gray-400">
          <ArrowLeft size={14} className="rtl:rotate-180" /> Back
        </Button>
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100 text-base">
          <FlaskConical size={18} className="text-indigo-600 dark:text-indigo-400" />
          {experiment.title}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500 dark:text-gray-400">
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
            className="ml-auto flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
          >
            Open in new tab <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Iframe */}
      {hasIframe ? (
        <div className="rounded-xl overflow-hidden border dark:border-gray-800 shadow-sm" style={{ height: 'calc(100vh - 260px)', minHeight: 480 }}>
          <iframe
            src={experiment.file}
            title={experiment.title}
            className="w-full h-full"
            allow="fullscreen"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 border dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-400">
          No interactive file available for this experiment.
        </div>
      )}

      {/* Description */}
      {experiment.description && (
        <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 border dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900">
          <p>{experiment.description}</p>
        </div>
      )}
    </div>
  )
}
