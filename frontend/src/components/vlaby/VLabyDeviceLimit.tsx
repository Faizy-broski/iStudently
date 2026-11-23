'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, MonitorSmartphone, RefreshCw, Smartphone, Monitor, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { releaseMyVLabyDevice, type VLabyDevice, type VLabyDeviceLimitData } from '@/lib/api/vlaby'

interface VLabyDeviceLimitProps {
  /** Limit and the user's registered devices, as returned with VLABY_DEVICE_LIMIT. */
  data?: VLabyDeviceLimitData | null
  /** Server message, shown under the title when present. */
  message?: string | null
  /** Called after a device is released (and by "Try again"): re-run the request that was refused. */
  onRetry: () => void
  onBack?: () => void
}

function PlatformIcon({ platform }: { platform: string | null }) {
  const p = (platform || '').toLowerCase()
  if (p === 'android' || p === 'ios' || p === 'mobile') return <Smartphone size={18} className="text-indigo-600 dark:text-indigo-400" />
  return <Monitor size={18} className="text-indigo-600 dark:text-indigo-400" />
}

/**
 * Shown when VLaby refuses a request because this account is already using it on the maximum
 * number of devices. The user can release one of their devices and try again.
 */
export default function VLabyDeviceLimit({ data, message, onRetry, onBack }: VLabyDeviceLimitProps) {
  const t = useTranslations('vlabyDevices')
  const locale = useLocale()
  const [devices, setDevices] = useState<VLabyDevice[]>(data?.devices ?? [])
  const [releasingId, setReleasingId] = useState<string | null>(null)
  const limit = data?.limit ?? null

  const release = async (device: VLabyDevice) => {
    setReleasingId(device.id)
    const res = await releaseMyVLabyDevice(device.id)
    setReleasingId(null)
    if (!res.success) {
      toast.error(res.error || t('releaseFailed'))
      return
    }
    setDevices((prev) => prev.filter((d) => d.id !== device.id))
    toast.success(t('released'))
    onRetry()
  }

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 text-center px-4">
      <MonitorSmartphone size={40} className="text-amber-400" />
      <div>
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('title')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          {limit ? t('description', { limit }) : message || t('descriptionNoLimit')}
        </p>
      </div>

      {devices.length > 0 ? (
        <ul className="w-full max-w-md flex flex-col gap-2 text-start">
          {devices.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
            >
              <PlatformIcon platform={d.platform} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {d.label || d.platform || t('unknownDevice')}
                  </span>
                  {d.is_current && <Badge variant="secondary">{t('thisDevice')}</Badge>}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('lastUsed', { date: fmt(d.last_seen_at) })}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={releasingId !== null}
                onClick={() => release(d)}
                aria-label={t('release')}
              >
                {releasingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span className="ms-1">{t('release')}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noDevices')}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Button onClick={onRetry} className="gap-1">
          <RefreshCw size={14} /> {t('tryAgain')}
        </Button>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft size={14} className="me-1 rtl:rotate-180" /> {t('back')}
          </Button>
        )}
      </div>
    </div>
  )
}
