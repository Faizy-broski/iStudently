'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { listPermissions, decidePermission, MiqatPermission } from '@/lib/api/miqat'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

const TYPE_LABEL: Record<MiqatPermission['type'], string> = {
  late_arrival: 'lateArrival',
  early_departure: 'earlyDeparture',
  full_day: 'fullDay',
}

export default function MiqatPermissionsPage() {
  const t = useTranslations('miqat.permissions')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusId = useCampus()?.selectedCampus?.id

  const [rows, setRows] = useState<MiqatPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState<string | null>(null)

  const load = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await listPermissions('pending', token, campusId)
    if (res.success && res.data) setRows(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [campusId])

  const handleDecide = async (id: string, status: 'approved' | 'rejected') => {
    const token = await getAuthToken()
    if (!token) return
    setDeciding(id)
    const res = await decidePermission(id, status, token, campusId)
    setDeciding(null)
    if (res.success) {
      toast.success(status === 'approved' ? t('approved') : t('rejected'))
      setRows((prev) => prev.filter((r) => r.id !== id))
    } else {
      toast.error(res.error || t('decideError'))
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-4 p-6 max-w-3xl" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {rows.length === 0 && <p className="text-muted-foreground text-sm">{t('noPending')}</p>}

      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : r.person_id}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="outline">{t(TYPE_LABEL[r.type])}</Badge>
                <span>{r.date_from === r.date_to ? r.date_from : `${r.date_from} → ${r.date_to}`}</span>
              </div>
              {r.reason && <p className="text-sm mt-1">{r.reason}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={deciding === r.id} onClick={() => handleDecide(r.id, 'approved')}>
                <Check className="h-4 w-4 me-1" />{t('approve')}
              </Button>
              <Button size="sm" variant="outline" disabled={deciding === r.id} onClick={() => handleDecide(r.id, 'rejected')}>
                <X className="h-4 w-4 me-1" />{t('reject')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
