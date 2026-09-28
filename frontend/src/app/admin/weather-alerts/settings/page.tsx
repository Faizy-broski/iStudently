'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Wifi } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getConfig, upsertConfig, testConnection, type AlertSeverity, type WeatherAlertConfig } from '@/lib/api/weather'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

const SEVERITIES: AlertSeverity[] = ['minor', 'moderate', 'severe', 'extreme']

export default function WeatherAlertsSettingsPage() {
  const t = useTranslations('weather_alerts.settings')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [existing, setExisting] = useState<WeatherAlertConfig | null>(null)
  const [severityThreshold, setSeverityThreshold] = useState<AlertSeverity>('moderate')
  const [locationOverride, setLocationOverride] = useState('')

  useEffect(() => {
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await getConfig(token, campusId)
      if (res.success && res.data) {
        setExisting(res.data)
        setSeverityThreshold(res.data.severity_threshold)
        setLocationOverride(res.data.location_query_override || '')
      }
      setLoading(false)
    })()
  }, [campusId])

  const handleSave = async () => {
    const token = await getAuthToken()
    if (!token) return
    setSaving(true)
    const res = await upsertConfig(
      { severity_threshold: severityThreshold, location_query_override: locationOverride.trim() || null },
      token,
      campusId
    )
    setSaving(false)
    if (res.success) {
      toast.success(t('saveSuccess'))
      setExisting(res.data ?? null)
    } else {
      toast.error(res.error || t('saveError'))
    }
  }

  const handleTest = async () => {
    const token = await getAuthToken()
    if (!token) return
    setTesting(true)
    const res = await testConnection(token, campusId)
    setTesting(false)
    if (res.success && res.data) {
      toast.success(t('testSuccess', { location: res.data.resolvedLocation }))
    } else {
      toast.error(res.error || t('testError'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('description')}</p>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('detectionTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('severityThreshold')}</Label>
            <Select value={severityThreshold} onValueChange={(v) => setSeverityThreshold(v as AlertSeverity)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`severity.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{t('severityThresholdHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('locationTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('locationHint')}</p>
          <div>
            <Label>{t('locationOverride')}</Label>
            <Input
              value={locationOverride}
              onChange={(e) => setLocationOverride(e.target.value)}
              placeholder={t('locationOverridePlaceholder')}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('locationOverrideHint')}</p>
          </div>
          <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Wifi className="h-4 w-4 me-2" />}
            {t('testConnection')}
          </Button>
          {existing?.last_polled_at && (
            <p className="text-xs text-muted-foreground">
              {existing.last_poll_status === 'error'
                ? t('lastPollError', { error: existing.last_poll_error || '' })
                : t('lastPollOk', { time: new Date(existing.last_polled_at).toLocaleString() })}
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
        {t('save')}
      </Button>
    </div>
  )
}
