'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePermissions } from '@/context/PermissionsContext'
import { installViewOnlyGuard, setViewOnlyState } from '@/lib/viewOnlyGuard'

/**
 * Marks the current page view-only when the user's role grants its module "can use" without
 * "can edit": shows a banner and turns on the write guard (see lib/viewOnlyGuard.ts).
 *
 * The module is the granted key that is the longest prefix of the current path. Pages that
 * aren't under any granted key (record detail pages, always-allowed pages) are left to the
 * server, which remains the source of truth. Users with no profile (full access) are never
 * view-only.
 */
export function ViewOnlyGate() {
  const t = useTranslations('admin')
  const pathname = usePathname()
  const { permissions, loading } = usePermissions()

  const viewOnly = React.useMemo(() => {
    if (loading || permissions === null || !pathname) return false
    let best: { key: string; can_edit: boolean } | null = null
    for (const p of permissions) {
      if (!p.can_use && !p.can_edit) continue
      if (pathname === p.module_key || pathname.startsWith(p.module_key + '/')) {
        if (!best || p.module_key.length > best.key.length) best = { key: p.module_key, can_edit: p.can_edit }
      }
    }
    return !!best && !best.can_edit
  }, [permissions, loading, pathname])

  const message = t('view_only_error')

  React.useEffect(() => {
    installViewOnlyGuard()
    setViewOnlyState({ active: viewOnly, message })
    return () => setViewOnlyState({ active: false, message: '' })
  }, [viewOnly, message])

  if (!viewOnly) return null
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <Eye className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">{t('view_only_title')}</p>
        <p className="opacity-90">{t('view_only_body')}</p>
      </div>
    </div>
  )
}
