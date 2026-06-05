'use client'

import * as React from 'react'
import { Paintbrush, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useSidebarTheme } from '@/context/SidebarThemeContext'
import { SidebarConfigEditor } from '@/components/sidebar/SidebarConfigEditor'
import {
  getSchoolSidebarConfig,
  updateSchoolSidebarConfig,
  resetSchoolSidebarConfig,
  type SidebarConfig,
  type UpdateSidebarConfigDTO,
} from '@/lib/api/sidebar-config'

export default function SidebarThemePage() {
  const { profile } = useAuth()
  const { refresh: refreshTheme } = useSidebarTheme()
  const schoolId = profile?.school_id ?? null

  const [config, setConfig] = React.useState<SidebarConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!schoolId) return
    setLoadingConfig(true)
    getSchoolSidebarConfig(schoolId)
      .then((result) => {
        if (result.success) setConfig(result.data ?? null)
      })
      .finally(() => setLoadingConfig(false))
  }, [schoolId])

  const handleSave = async (dto: UpdateSidebarConfigDTO) => {
    if (!schoolId) return
    setIsSaving(true)
    try {
      const result = await updateSchoolSidebarConfig(schoolId, dto)
      if (result.success) {
        setConfig(result.data ?? null)
        toast.success('Sidebar theme saved')
        refreshTheme()
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
    if (!schoolId) return
    setIsSaving(true)
    try {
      const result = await resetSchoolSidebarConfig(schoolId)
      if (result.success) {
        setConfig(result.data ?? null)
        toast.success('Sidebar theme reset to defaults')
        refreshTheme()
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
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          Sidebar Theme
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Customize the sidebar background color and image for your school. Campus-specific themes
          override this and can be set from the{' '}
          <a href="/admin/settings/campuses" className="underline text-[#57A3CC]">
            Campuses
          </a>{' '}
          settings page.
        </p>
      </div>

      {/* Editor */}
      {loadingConfig ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Loading configuration...</p>
        </div>
      ) : !schoolId ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Paintbrush className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-400">No school found for your account.</p>
        </div>
      ) : (
        <SidebarConfigEditor
          initialConfig={config}
          uploadScope={schoolId}
          onSave={handleSave}
          onReset={handleReset}
          isSaving={isSaving}
          showResetButton
        />
      )}
    </div>
  )
}
