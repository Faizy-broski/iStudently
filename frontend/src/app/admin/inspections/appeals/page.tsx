'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, User, ArrowUpCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCampus } from '@/context/CampusContext'
import {
  listAppealsForSchool, listAppealsAssignedToMe, type InspectionAppeal, type AppealStatus,
} from '@/lib/api/inspection-appeal'

const STATUS_STYLES: Record<AppealStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated: 'bg-purple-100 text-purple-800',
  upheld: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
}

export default function AdminAppealsPage() {
  const t = useTranslations('inspections.appeals')
  const campusCtx = useCampus()
  const schoolId = campusCtx?.selectedCampus?.id

  const [appeals, setAppeals] = useState<InspectionAppeal[]>([])
  const [assignedToMe, setAssignedToMe] = useState<Array<InspectionAppeal & { school: { id: string; name: string } }>>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    listAppealsAssignedToMe().then((res) => setAssignedToMe(res.data || []))
    if (!schoolId) return
    setLoading(true)
    listAppealsForSchool(schoolId).then((res) => {
      setAppeals(res.data || [])
      setLoading(false)
    })
  }, [schoolId])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('list_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin_list_subtitle')}</p>
      </div>

      {assignedToMe.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-purple-600" />
              {t('escalated_to_me_title')}
            </CardTitle>
            <CardDescription>{t('escalated_to_me_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {assignedToMe.map((a) => (
                <Link key={a.id} href={`/admin/inspections/appeals/${a.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : ''}</div>
                      <div className="text-xs text-gray-500 truncate">{a.school?.name}</div>
                    </div>
                  </div>
                  <Badge className={STATUS_STYLES[a.status]} variant="outline">{t(`status_${a.status}`)}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {!schoolId ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('select_campus_prompt')}</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : appeals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_appeals')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {appeals.map((a) => (
                <Link key={a.id} href={`/admin/inspections/appeals/${a.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{a.teacher ? `${a.teacher.first_name} ${a.teacher.last_name}` : ''}</div>
                      <div className="text-xs text-gray-500 truncate">{a.reason}</div>
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
