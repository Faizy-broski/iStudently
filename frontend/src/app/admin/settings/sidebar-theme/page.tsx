'use client'

import * as React from 'react'
import { Paintbrush, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useSidebarTheme } from '@/context/SidebarThemeContext'
import { SidebarConfigEditor } from '@/components/sidebar/SidebarConfigEditor'
import {
  getSchoolSidebarConfig,
  updateSchoolSidebarConfig,
  resetSchoolSidebarConfig,
  getCampusSidebarConfig,
  updateCampusSidebarConfig,
  resetCampusSidebarConfig,
  type SidebarConfig,
  type UpdateSidebarConfigDTO,
} from '@/lib/api/sidebar-config'

export default function SidebarThemePage() {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const { refresh: refreshTheme } = useSidebarTheme()

  const schoolId = profile?.school_id ?? null
  const selectedCampus = campusCtx?.selectedCampus ?? null
  const isEditingCampus = selectedCampus !== null

  const [config, setConfig] = React.useState<SidebarConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setConfig(null)
    setLoadingConfig(true)

    if (isEditingCampus) {
      getCampusSidebarConfig(selectedCampus.id)
        .then((result) => {
          if (result.success) setConfig(result.data ?? null)
        })
        .finally(() => setLoadingConfig(false))
    } else if (schoolId) {
      getSchoolSidebarConfig(schoolId)
        .then((result) => {
          if (result.success) setConfig(result.data ?? null)
        })
        .finally(() => setLoadingConfig(false))
    } else {
      setLoadingConfig(false)
    }
  }, [selectedCampus?.id, schoolId, isEditingCampus])

  const handleSave = async (dto: UpdateSidebarConfigDTO) => {
    setIsSaving(true)
    try {
      const result = isEditingCampus
        ? await updateCampusSidebarConfig(selectedCampus.id, dto)
        : await updateSchoolSidebarConfig(schoolId!, dto)

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
    setIsSaving(true)
    try {
      const result = isEditingCampus
        ? await resetCampusSidebarConfig(selectedCampus.id)
        : await resetSchoolSidebarConfig(schoolId!)

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
          {isEditingCampus
            ? `Sidebar Theme — ${selectedCampus.name}`
            : 'Sidebar Theme'}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          {isEditingCampus ? (
            <>
              Customizing the sidebar theme for <strong>{selectedCampus.name}</strong> only.
              This overrides the school-wide default for this campus. To edit the school-wide
              default, switch to{' '}
              <span className="text-[#57A3CC] font-medium">All Campuses</span> in the header.
            </>
          ) : (
            <>
              Customize the sidebar background color and image for your school. Campus-specific
              themes override this and can be set by selecting a campus from the header dropdown.
            </>
          )}
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
          uploadScope={isEditingCampus ? selectedCampus.id : schoolId}
          onSave={handleSave}
          onReset={handleReset}
          isSaving={isSaving}
          showResetButton
          infoAlert={
            isEditingCampus
              ? undefined
              : 'This is the school-wide default. Select a specific campus from the header to customize per-campus.'
          }
        />
      )}
    </div>
  )
}
