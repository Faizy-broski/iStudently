'use client'

import { useTranslations } from 'next-intl'

export default function ArabicFluencyViewer() {
  const t = useTranslations('arabicFluency')

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <iframe
        src="/arabic-fluency/home.html"
        allow="fullscreen"
        className="w-full flex-1 border-none"
        title={t('title')}
      />
    </div>
  )
}
