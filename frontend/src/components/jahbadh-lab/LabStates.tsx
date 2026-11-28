'use client'

import { AlertCircle, FlaskConical, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/** The lab files are not on this server. Only admins get the setup hint. */
export function LabNotInstalled({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('jahbadhLab')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center dark:border-gray-800">
      <FlaskConical className="size-12 text-indigo-500" aria-hidden />
      <p className="font-semibold text-gray-800 dark:text-gray-100">{t('notInstalledTitle')}</p>
      <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">{t('notInstalledBody')}</p>
      {isAdmin && (
        <p className="max-w-md rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('notInstalledAdminHint')}
        </p>
      )}
    </div>
  )
}

export function LabLoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('jahbadhLab')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border p-10 text-center dark:border-gray-800">
      <AlertCircle className="size-10 text-red-500" aria-hidden />
      <p className="text-sm text-gray-600 dark:text-gray-300">{t('loadError')}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="size-3.5" /> {t('retry')}
      </Button>
    </div>
  )
}
