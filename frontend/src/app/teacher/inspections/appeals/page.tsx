'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, MessageSquareWarning } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listMyAppeals, type InspectionAppeal, type AppealStatus } from '@/lib/api/inspection-appeal'

const STATUS_STYLES: Record<AppealStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated: 'bg-purple-100 text-purple-800',
  upheld: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
}

export default function TeacherAppealsPage() {
  const t = useTranslations('inspections.appeals')
  const [appeals, setAppeals] = useState<InspectionAppeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMyAppeals().then((res) => {
      setAppeals(res.data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('list_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('teacher_list_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : appeals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_appeals')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {appeals.map((a) => (
                <Link key={a.id} href={`/teacher/inspections/appeals/${a.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <MessageSquareWarning className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-800 truncate max-w-xs">{a.reason}</div>
                      <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <Badge className={STATUS_STYLES[a.status]} variant="outline">{t(`status_${a.status}`)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
