'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { ForumThreadView } from '@/components/inspections/ForumThreadView'

export default function InspectorThreadPage() {
  const t = useTranslations('inspections.community')
  const params = useParams()
  const threadId = params?.threadId as string

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link href="/inspector/community" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_community')}
      </Link>
      {threadId && <ForumThreadView threadId={threadId} />}
    </div>
  )
}
