'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { AppealThreadView } from '@/components/inspections/AppealThreadView'

export default function AdminAppealDetailPage() {
  const t = useTranslations('inspections.appeals')
  const params = useParams()
  const id = params?.id as string

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link href="/admin/inspections/appeals" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_appeals')}
      </Link>
      {id && <AppealThreadView appealId={id} />}
    </div>
  )
}
