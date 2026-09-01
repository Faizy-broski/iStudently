'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Save } from 'lucide-react'
import { getHifziSettings, updateHifziSettings, type HifziSettings } from '@/lib/api/hifzi'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

export default function HifziSettingsPage() {
    const t = useTranslations('hifzi.settings')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [settings, setSettings] = useState<HifziSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getHifziSettings(campusId).then((res) => {
            if (res.success && res.data) setSettings(res.data)
            setLoading(false)
        })
    }, [campusId])

    const handleSave = async () => {
        if (!settings) return
        setSaving(true)
        const res = await updateHifziSettings(settings, campusId)
        if (res.success) {
            toast.success(t('saveSuccess'))
        } else {
            toast.error(res.error || t('saveError'))
        }
        setSaving(false)
    }

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6 max-w-2xl" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                {t('title')}
            </h1>

            <Card>
                <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-sm">{t('srsSettings')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Similarity factor</Label>
                            <Input
                                type="number" step="0.05" min={0} max={1}
                                value={settings.srsSimilarityFactor}
                                onChange={(e) => setSettings({ ...settings, srsSimilarityFactor: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Review intensity (0.5–1.5)</Label>
                            <Input
                                type="number" step="0.05" min={0.5} max={1.5}
                                value={settings.srsReviewIntensity}
                                onChange={(e) => setSettings({ ...settings, srsReviewIntensity: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Recency factor</Label>
                            <Input
                                type="number" step="0.05" min={0} max={1}
                                value={settings.srsRecencyFactor}
                                onChange={(e) => setSettings({ ...settings, srsRecencyFactor: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max interval (days)</Label>
                            <Input
                                type="number" min={1}
                                value={settings.srsMaxIntervalDays}
                                onChange={(e) => setSettings({ ...settings, srsMaxIntervalDays: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-sm">{t('assignmentSettings')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Critical threshold (%)</Label>
                            <Input
                                type="number" min={0} max={100}
                                value={settings.assignmentCriticalThreshold}
                                onChange={(e) => setSettings({ ...settings, assignmentCriticalThreshold: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Block new-memorization threshold (units)</Label>
                            <Input
                                type="number" min={1}
                                value={settings.assignmentNewBlockThreshold}
                                onChange={(e) => setSettings({ ...settings, assignmentNewBlockThreshold: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max daily review units</Label>
                            <Input
                                type="number" min={1}
                                value={settings.assignmentMaxDailyReviewUnits}
                                onChange={(e) => setSettings({ ...settings, assignmentMaxDailyReviewUnits: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Near-review count</Label>
                            <Input
                                type="number" min={0}
                                value={settings.assignmentNearReviewCount}
                                onChange={(e) => setSettings({ ...settings, assignmentNearReviewCount: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5 space-y-4">
                    <h3 className="font-semibold text-sm">{t('title')}</h3>
                    <div className="space-y-1.5 max-w-[240px]">
                        <Label className="text-xs">{t('absenceAlertMinutes')}</Label>
                        <Input
                            type="number" min={1}
                            value={settings.absenceAlertMinutes}
                            onChange={(e) => setSettings({ ...settings, absenceAlertMinutes: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={settings.guardianNotifyAfterSession}
                            onCheckedChange={(v) => setSettings({ ...settings, guardianNotifyAfterSession: !!v })}
                        />
                        <span className="text-sm">{t('guardianNotify')}</span>
                    </div>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving} className="gradient-blue text-white border-0">
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                Save
            </Button>
        </div>
    )
}
