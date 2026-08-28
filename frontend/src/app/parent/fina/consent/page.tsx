'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listMyWards, type Ward } from '@/lib/api/fina-consent'
import { ConsentLevelPicker, consentLevelLabel } from '@/components/fina/ConsentLevelPicker'

export default function FinaConsentPage() {
  const t = useTranslations('fina.consent')
  const [wards, setWards] = useState<Ward[] | null>(null)
  const [activeWard, setActiveWard] = useState<Ward | null>(null)

  const load = useCallback(() => {
    listMyWards().then((res) => setWards(res.data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('page_subtitle')}</p>
      </div>

      {wards === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : wards.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <Users className="h-6 w-6 text-gray-300" />
            {t('empty_wards')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {wards.map((ward) => {
            const name = [ward.firstName, ward.lastName].filter(Boolean).join(' ')
            return (
              <Card key={ward.studentId}>
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{name}</div>
                    {ward.sectionName && (
                      <div className="text-xs text-gray-400">{t('section_label', { section: ward.sectionName })}</div>
                    )}
                    <div className="text-sm text-gray-600 mt-1">
                      {t('current_label', { label: consentLevelLabel(t, ward.currentLevel, name) })}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setActiveWard(ward)}>
                    {t('change_button')}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {activeWard && (
        <ConsentLevelPicker
          ward={activeWard}
          open={!!activeWard}
          onOpenChange={(open) => { if (!open) setActiveWard(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
