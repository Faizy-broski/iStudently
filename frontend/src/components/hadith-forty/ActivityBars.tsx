'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings2 } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { saveSettings, type ActivityPoint, type ModuleSettings } from '@/lib/api/hadith-forty'

export function ActivityBars({
  activity,
  settings,
  campusId,
  onSettingsSaved,
}: {
  activity: ActivityPoint[]
  settings: ModuleSettings
  campusId?: string
  onSettingsSaved: () => void
}) {
  const t = useTranslations('hadithForty')
  const [editing, setEditing] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(String(settings.dailyGoal))
  const [sessionCap, setSessionCap] = useState(String(settings.sessionCap))
  const [saving, setSaving] = useState(false)

  const max = Math.max(1, ...activity.map((a) => a.repetitions), settings.dailyGoal)

  const handleSave = async () => {
    const token = await getAuthToken()
    if (!token) return
    setSaving(true)
    const res = await saveSettings({ dailyGoal: Number(dailyGoal), sessionCap: Number(sessionCap) }, token, campusId)
    setSaving(false)
    if (res.success) {
      toast.success(t('settings.saved'))
      setEditing(false)
      onSettingsSaved()
    } else {
      toast.error(res.error || t('settings.saveError'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">{t('activity.title')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          <Settings2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-xs">{t('settings.dailyGoal')}</label>
              <Input type="number" min={1} max={500} value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value)} />
            </div>
            <div>
              <label className="text-muted-foreground text-xs">{t('settings.sessionCap')}</label>
              <Input type="number" min={1} max={42} value={sessionCap} onChange={(e) => setSessionCap(e.target.value)} />
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {t('settings.save')}
            </Button>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-2" style={{ height: 96 }}>
            {activity.map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={point.goalMet ? 'bg-primary w-full rounded-t' : 'bg-muted w-full rounded-t'}
                  style={{ height: `${Math.max(4, (point.repetitions / max) * 72)}px` }}
                  title={`${point.date}: ${point.repetitions}`}
                />
                <span className="text-muted-foreground text-[10px]">{point.date.slice(8, 10)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
