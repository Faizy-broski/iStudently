'use client'

import { useSchoolSettings } from '@/context/SchoolSettingsContext'

export default function AdminHumanAtlasPage() {
  const { isPluginActive, loading } = useSchoolSettings()

  if (loading) return null

  if (!isPluginActive('human_atlas')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] text-muted-foreground">
        This resource isn&apos;t enabled for your school.
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/human-atlas/index.html"
        allow="fullscreen"
        className="w-full flex-1 border-none"
        title="Human Atlas 3D Anatomy Explorer"
      />
    </div>
  )
}
