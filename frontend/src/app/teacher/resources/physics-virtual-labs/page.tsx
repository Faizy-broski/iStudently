'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'

const LAB_URL = 'https://physics-en.nobook.com/console/templates/resource'

export default function TeacherPhysicsVirtualLabsPage() {
  const t = useTranslations('teacherPages.physicsVirtualLabs')
  const [iframeError, setIframeError] = useState(false)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#022172]" />
          <span className="font-semibold text-sm text-gray-800">
            {t('pageTitle')}
          </span>
        </div>

      </div>

      {iframeError ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
          <FlaskConical className="h-12 w-12 text-[#022172]" />
          <div>
            <p className="font-semibold text-gray-700 mb-1">{t('cannotLoad')}</p>
            <p className="text-sm text-gray-500 mb-4">
              {t('mustOpenInNewTab')}
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={LAB_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                {t('openVirtualLabs')}
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <iframe
          src={LAB_URL}
          title={t('pageTitle')}
          className="flex-1 w-full border-none"
          allow="fullscreen"
          onError={() => setIframeError(true)}
        />
      )}
    </div>
  )
}
