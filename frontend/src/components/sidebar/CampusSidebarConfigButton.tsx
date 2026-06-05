'use client'

import * as React from 'react'
import { Paintbrush, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SidebarConfigEditor } from '@/components/sidebar/SidebarConfigEditor'
import {
  getCampusSidebarConfig,
  updateCampusSidebarConfig,
  resetCampusSidebarConfig,
  type SidebarConfig,
  type UpdateSidebarConfigDTO,
} from '@/lib/api/sidebar-config'
import { useSidebarTheme } from '@/context/SidebarThemeContext'
import { useCampus } from '@/context/CampusContext'

interface CampusSidebarConfigButtonProps {
  campusId: string
  campusName: string
}

export function CampusSidebarConfigButton({
  campusId,
  campusName,
}: CampusSidebarConfigButtonProps) {
  const t = useTranslations('sidebarConfig')
  const { refresh: refreshTheme } = useSidebarTheme()
  const campusCtx = useCampus()

  const [open, setOpen] = React.useState(false)
  const [config, setConfig] = React.useState<SidebarConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const loadConfig = React.useCallback(async () => {
    setLoadingConfig(true)
    try {
      const result = await getCampusSidebarConfig(campusId)
      if (result.success) setConfig(result.data ?? null)
    } catch {
      // silent
    } finally {
      setLoadingConfig(false)
    }
  }, [campusId])

  const handleOpen = () => {
    setOpen(true)
    loadConfig()
  }

  const handleSave = async (dto: UpdateSidebarConfigDTO) => {
    setIsSaving(true)
    try {
      const result = await updateCampusSidebarConfig(campusId, dto)
      if (result.success) {
        setConfig(result.data ?? null)
        toast.success(t('saved'))
        // Refresh sidebar theme if this campus is currently selected
        if (campusCtx?.selectedCampus?.id === campusId) {
          refreshTheme()
        }
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
      const result = await resetCampusSidebarConfig(campusId)
      if (result.success) {
        setConfig(result.data ?? null)
        toast.success(t('saved'))
        if (campusCtx?.selectedCampus?.id === campusId) {
          refreshTheme()
        }
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
    <>
      <Button
        size="sm"
        className="w-full gradient-teal text-white hover:shadow-md transition-all border-0 h-8"
        onClick={handleOpen}
      >
        <Paintbrush className="h-3.5 w-3.5 me-1.5" />
        Sidebar Theme
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center shrink-0">
                <Paintbrush className="h-4 w-4 text-white" />
              </div>
              Sidebar Theme — {campusName}
            </DialogTitle>
            <DialogDescription>
              {t('description')}
            </DialogDescription>
          </DialogHeader>

          {loadingConfig ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
              <p className="text-sm text-gray-400">Loading configuration...</p>
            </div>
          ) : (
            <div className="mt-2">
              <SidebarConfigEditor
                initialConfig={config}
                uploadScope={campusId}
                onSave={handleSave}
                onReset={handleReset}
                isSaving={isSaving}
                showResetButton
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
