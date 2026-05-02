'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { updateSchoolSettings } from '@/lib/api/school-settings'
import { useCampus } from '@/context/CampusContext'
import { PLUGIN_REGISTRY } from '@/config/plugins'
import { Loader2, Check, X, Settings } from 'lucide-react'
import { toast } from 'sonner'

export default function PluginsPage() {
  const t = useTranslations('setup.plugins_page')
  const { settings, loading, isPluginActive, refreshSettings } = useSchoolSettings()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return PLUGIN_REGISTRY
    return PLUGIN_REGISTRY.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    )
  }, [search])

  const handleToggle = async (pluginId: string) => {
    if (!settings) return
    setToggling(pluginId)

    const currentlyActive = isPluginActive(pluginId)
    const newState = !currentlyActive

    const updatedPlugins: Record<string, boolean> = {
      ...(settings.active_plugins ?? {}),
      [pluginId]: newState,
    }

    const extraUpdates: Record<string, unknown> = {}
    if (pluginId === 'automatic_attendance') {
      extraUpdates.auto_attendance_enabled = newState
    }

    const pluginName = PLUGIN_REGISTRY.find((p) => p.id === pluginId)?.name ?? pluginId

    try {
      const result = await updateSchoolSettings({ active_plugins: updatedPlugins, ...extraUpdates }, campusId)
      if (result.success) {
        await refreshSettings()
        toast.success(
          newState
            ? t('toast_activated', { name: pluginName })
            : t('toast_deactivated', { name: pluginName })
        )
      } else {
        toast.error(result.error || t('err_update'))
      }
    } catch {
      toast.error(t('err_update'))
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="py-6 px-6 space-y-4">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t('plugins_found', { count: filtered.length })}
        </p>
        <input
          type="search"
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-[#022172] bg-background"
        />
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[#022172] uppercase text-xs tracking-wide">
              <th className="px-4 py-2 text-left w-32"></th>
              <th className="px-4 py-2 text-left">{t('th_title')}</th>
              <th className="px-4 py-2 text-center w-28">{t('th_activated')}</th>
              <th className="px-4 py-2 text-center w-32">{t('th_configuration')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((plugin) => {
              const active = isPluginActive(plugin.id)
              const isToggling = toggling === plugin.id

              return (
                <tr key={plugin.id} className="hover:bg-muted/20 transition-colors">
                  {/* Activate / Deactivate */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(plugin.id)}
                      disabled={!!isToggling}
                      className={[
                        'flex items-center gap-1 text-xs font-semibold tracking-wide',
                        active
                          ? 'text-[#022172] hover:text-red-600'
                          : 'text-[#022172] hover:text-green-700',
                        isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : active ? (
                        <span className="text-base leading-none">−</span>
                      ) : (
                        <span className="text-base leading-none">+</span>
                      )}
                      {active ? t('btn_deactivate') : t('btn_activate')}
                    </button>
                  </td>

                  {/* Title + description */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#022172]">{plugin.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plugin.description}</p>
                  </td>

                  {/* Activated status */}
                  <td className="px-4 py-3 text-center">
                    {active
                      ? <Check className="h-4 w-4 text-green-600 mx-auto" />
                      : <X className="h-4 w-4 text-red-500 mx-auto" />
                    }
                  </td>

                  {/* Configuration link */}
                  <td className="px-4 py-3 text-center">
                    {active && plugin.settingsHref ? (
                      <Link
                        href={plugin.settingsHref}
                        className="text-xs text-[#022172] hover:underline inline-flex items-center gap-1"
                      >
                        <Settings className="h-3 w-3" />
                        {t('btn_configuration')}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              )
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t('no_results')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
