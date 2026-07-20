'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCampus } from '@/context/CampusContext'
import { getJitsiSettings, updateJitsiSettings, type JitsiSettings } from '@/lib/api/school-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

const DEFAULT: JitsiSettings = { jitsi_domain: '' }

export default function JitsiConfigurationPage() {
  const t = useTranslations('live_class')
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? null

  const [form, setForm] = useState<JitsiSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getJitsiSettings(campusId).then((res) => {
      if (res.success && res.data) setForm(res.data)
      else setForm(DEFAULT)
    }).finally(() => setLoading(false))
  }, [campusId])

  const handleSave = async () => {
    setSaving(true)
    const res = await updateJitsiSettings(form, campusId)
    setSaving(false)
    if (res.success) toast.success(t('toast_config_saved'))
    else toast.error(res.error || t('toast_config_error'))
  }

  if (loading) return <div className="p-6">{t('loading')}</div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t('configuration')}</CardTitle>
          <CardDescription>{t('configuration_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('jitsi_domain_label')}</Label>
            <Input
              value={form.jitsi_domain}
              onChange={(e) => setForm({ jitsi_domain: e.target.value })}
              placeholder={t('jitsi_domain_placeholder')}
            />
            <p className="text-xs text-muted-foreground">{t('jitsi_domain_help')}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? t('saving') : t('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
