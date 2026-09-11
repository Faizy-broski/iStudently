'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, MapPin } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getSchoolConfig, upsertSchoolConfig, MiqatSchoolConfig } from '@/lib/api/miqat'
import { toast } from 'sonner'

const DEFAULTS = { radius_m: 150, max_accuracy_m: 50, photo_retention_days: 7 }

export default function MiqatSettingsPage() {
  const t = useTranslations('miqat.settings')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radiusM, setRadiusM] = useState(String(DEFAULTS.radius_m))
  const [maxAccuracyM, setMaxAccuracyM] = useState(String(DEFAULTS.max_accuracy_m))
  const [photoRetentionDays, setPhotoRetentionDays] = useState(String(DEFAULTS.photo_retention_days))
  const [officialStart, setOfficialStart] = useState('07:00')
  const [gracePeriod, setGracePeriod] = useState('5')
  const [existing, setExisting] = useState<MiqatSchoolConfig | null>(null)

  useEffect(() => {
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await getSchoolConfig(token)
      if (res.success && res.data) {
        const cfg = res.data
        setExisting(cfg)
        setLat(String(cfg.lat ?? ''))
        setLng(String(cfg.lng ?? ''))
        setRadiusM(String(cfg.radius_m))
        setMaxAccuracyM(String(cfg.max_accuracy_m))
        setPhotoRetentionDays(String(cfg.photo_retention_days))
        const policy = cfg.policy_json as any
        if (policy?.official_start_minutes != null) {
          const h = Math.floor(policy.official_start_minutes / 60)
          const m = policy.official_start_minutes % 60
          setOfficialStart(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
        if (policy?.grace_period_minutes != null) setGracePeriod(String(policy.grace_period_minutes))
      }
      setLoading(false)
    })()
  }, [])

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude))
        setLng(String(pos.coords.longitude))
      },
      () => toast.error(t('locationError'))
    )
  }

  const handleSave = async () => {
    const token = await getAuthToken()
    if (!token) return
    const [h, m] = officialStart.split(':').map(Number)
    setSaving(true)
    const res = await upsertSchoolConfig(
      {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_m: parseInt(radiusM, 10),
        max_accuracy_m: parseInt(maxAccuracyM, 10),
        photo_retention_days: parseInt(photoRetentionDays, 10),
        policy_json: {
          official_start_minutes: h * 60 + (m || 0),
          grace_period_minutes: parseInt(gracePeriod, 10),
          late_cutoff_minutes: h * 60 + (m || 0) + 60,
        },
      },
      token
    )
    setSaving(false)
    if (res.success) {
      toast.success(t('saveSuccess'))
      setExisting(res.data ?? null)
    } else {
      toast.error(res.error || t('saveError'))
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
      {!existing && <p className="text-sm text-muted-foreground">{t('firstTimeNotice')}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">{t('geofenceTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('lat')}</Label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="32.8872" />
            </div>
            <div>
              <Label>{t('lng')}</Label>
              <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="13.1913" />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={useCurrentLocation}>
            <MapPin className="h-4 w-4 me-2" />{t('useCurrentLocation')}
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('radiusM')}</Label>
              <Input type="number" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} />
            </div>
            <div>
              <Label>{t('maxAccuracyM')}</Label>
              <Input type="number" value={maxAccuracyM} onChange={(e) => setMaxAccuracyM(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('policyTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('officialStart')}</Label>
              <Input type="time" value={officialStart} onChange={(e) => setOfficialStart(e.target.value)} />
            </div>
            <div>
              <Label>{t('gracePeriod')}</Label>
              <Input type="number" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('photoTitle')}</CardTitle></CardHeader>
        <CardContent>
          <Label>{t('photoRetentionDays')}</Label>
          <Input type="number" value={photoRetentionDays} onChange={(e) => setPhotoRetentionDays(e.target.value)} className="max-w-[160px]" />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !lat || !lng}>
        {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
        {t('save')}
      </Button>
    </div>
  )
}
