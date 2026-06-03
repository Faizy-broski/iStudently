'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Paintbrush, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SidebarConfigEditor } from '@/components/sidebar/SidebarConfigEditor'
import { useSidebarTheme } from '@/context/SidebarThemeContext'
import {
  getSuperadminSidebarConfig,
  updateSuperadminSidebarConfig,
  resetSuperadminSidebarConfig,
  type SidebarConfig,
  type UpdateSidebarConfigDTO,
} from '@/lib/api/sidebar-config'

export default function SuperadminSidebarSettingsPage() {
  const t = useTranslations('sidebarConfig')
  const { setConfig: setGlobalTheme } = useSidebarTheme()

  const [config, setConfig] = React.useState<SidebarConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    let mounted = true
    getSuperadminSidebarConfig()
      .then((result) => {
        if (mounted && result.success) {
          setConfig(result.data ?? null)
        }
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleSave = async (dto: UpdateSidebarConfigDTO) => {
    setIsSaving(true)
    try {
      const result = await updateSuperadminSidebarConfig(dto)
      if (result.success) {
        setConfig(result.data ?? null)
        // Immediately update the live sidebar — no page refresh needed
        if (result.data) setGlobalTheme(result.data)
        toast.success(t('saved'))
      } else {
        toast.error(result.error ?? 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    try {
      const result = await resetSuperadminSidebarConfig()
      if (result.success) {
        setConfig(result.data ?? null)
        if (result.data) setGlobalTheme(result.data)
        toast.success(t('saved'))
      } else {
        toast.error(result.error ?? 'Reset failed')
      }
    } catch {
      toast.error('Reset failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl gradient-teal flex items-center justify-center shrink-0 shadow-md">
          <Paintbrush className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-800">{t('superadmin_info')}</p>
      </div>

      {/* Editor Card */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center">
              <Paintbrush className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">{t('title')}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {loadingConfig ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Loading configuration...</p>
            </div>
          ) : (
            <SidebarConfigEditor
              initialConfig={config}
              uploadScope="superadmin"
              onSave={handleSave}
              onReset={handleReset}
              isSaving={isSaving}
              showResetButton
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
