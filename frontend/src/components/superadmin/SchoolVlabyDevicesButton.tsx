'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, MonitorSmartphone, RefreshCw, Save, Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  getVLabyDeviceLimit,
  getVLabySchoolDevices,
  removeVLabySchoolDevice,
  resetVLabyUserDevices,
  setVLabyDeviceLimit,
  type VLabySchoolDevice,
} from '@/lib/api/vlaby'

interface SchoolVlabyDevicesButtonProps {
  schoolId: string
  schoolName: string
}

interface UserGroup {
  profileId: string
  name: string
  role: string | null
  devices: VLabySchoolDevice[]
}

const MAX_LIMIT = 20

/**
 * Super admin: how many devices each user of a school may use VLaby on at the same time
 * (blank = unlimited), and the devices registered so far with remove / reset actions.
 */
export function SchoolVlabyDevicesButton({ schoolId, schoolName }: SchoolVlabyDevicesButtonProps) {
  const t = useTranslations('vlabyDevices')
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [limitText, setLimitText] = React.useState('')
  const [devices, setDevices] = React.useState<VLabySchoolDevice[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [limitRes, devicesRes] = await Promise.all([getVLabyDeviceLimit(schoolId), getVLabySchoolDevices(schoolId)])
    setLoading(false)
    if (!limitRes.success) {
      // 503 not_migrated: the VLaby devices SQL migration has not been run yet.
      setLoadError(limitRes.code === 'not_migrated' ? t('notMigrated') : limitRes.error || t('loadFailed'))
      return
    }
    setLimitText(limitRes.data?.limit ? String(limitRes.data.limit) : '')
    setDevices(devicesRes.success ? devicesRes.data ?? [] : [])
    if (!devicesRes.success) toast.error(devicesRes.error || t('loadDevicesFailed'))
  }, [schoolId, t])

  React.useEffect(() => {
    if (open) load()
  }, [open, load])

  const parsed = limitText.trim() === '' ? null : Number(limitText)
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_LIMIT)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const res = await setVLabyDeviceLimit(schoolId, parsed)
    setSaving(false)
    if (res.success) toast.success(t('saved'))
    else toast.error(res.error || t('saveFailed'))
  }

  const removeDevice = async (d: VLabySchoolDevice) => {
    setBusyId(d.id)
    const res = await removeVLabySchoolDevice(d.id)
    setBusyId(null)
    if (res.success) {
      setDevices((prev) => prev.filter((x) => x.id !== d.id))
      toast.success(t('deviceRemoved'))
    } else toast.error(res.error || t('removeFailed'))
  }

  const resetUser = async (g: UserGroup) => {
    if (!window.confirm(t('resetConfirm', { name: g.name }))) return
    setBusyId(g.profileId)
    const res = await resetVLabyUserDevices(g.profileId, schoolId)
    setBusyId(null)
    if (res.success) {
      setDevices((prev) => prev.filter((x) => x.profile_id !== g.profileId))
      toast.success(t('userReset'))
    } else toast.error(res.error || t('removeFailed'))
  }

  const groups = React.useMemo<UserGroup[]>(() => {
    const map = new Map<string, UserGroup>()
    for (const d of devices) {
      const g = map.get(d.profile_id) ?? { profileId: d.profile_id, name: d.user_name || d.profile_id, role: d.role, devices: [] }
      g.devices.push(d)
      map.set(d.profile_id, g)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [devices, locale])

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="w-full gradient-blue text-white hover:shadow-md transition-all border-0 h-8"
        onClick={() => setOpen(true)}
      >
        <MonitorSmartphone className="h-3.5 w-3.5 me-1.5" />
        {t('button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle', { school: schoolName })}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-red-500">{loadError}</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5 me-1.5" /> {t('tryAgain')}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="vlaby-device-limit">{t('limitLabel')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="vlaby-device-limit"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_LIMIT}
                    value={limitText}
                    onChange={(e) => setLimitText(e.target.value)}
                    placeholder={t('unlimited')}
                    className="max-w-[10rem]"
                  />
                  <Button onClick={save} disabled={saving || !valid}>
                    {saving ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" /> : <Save className="h-4 w-4 me-1.5" />}
                    {t('save')}
                  </Button>
                </div>
                <p className={`text-xs ${valid ? 'text-muted-foreground' : 'text-red-500'}`}>
                  {valid ? t('limitHint', { max: MAX_LIMIT }) : t('limitInvalid', { max: MAX_LIMIT })}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t('registeredDevices', { count: devices.length })}</h3>
                  <Button variant="ghost" size="sm" onClick={load}>
                    <RefreshCw className="h-3.5 w-3.5 me-1.5" /> {t('refresh')}
                  </Button>
                </div>

                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('noDevicesSchool')}</p>
                ) : (
                  groups.map((g) => (
                    <div key={g.profileId} className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[g.role, t('deviceCount', { count: g.devices.length })].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => resetUser(g)}
                        >
                          {busyId === g.profileId ? (
                            <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                          ) : (
                            <UserX className="h-3.5 w-3.5 me-1.5" />
                          )}
                          {t('resetUser')}
                        </Button>
                      </div>
                      <ul className="space-y-1.5">
                        {g.devices.map((d) => (
                          <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                            <div className="min-w-0">
                              <p className="text-sm truncate">{d.label || d.platform || t('unknownDevice')}</p>
                              <p className="text-xs text-muted-foreground">{t('lastUsed', { date: fmt(d.last_seen_at) })}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId !== null}
                              onClick={() => removeDevice(d)}
                              aria-label={t('removeDevice')}
                            >
                              {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
