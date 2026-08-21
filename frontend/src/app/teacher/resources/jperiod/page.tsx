'use client'

import { useTranslations } from 'next-intl'

export default function TeacherJperiodPage() {
  const t = useTranslations('teacherPages.resourcesJperiod')

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/jperiod/index.html"
        allow="fullscreen"
        className="w-full flex-1 border-none"
        title={t('title')}
      />
    </div>
  )
}
