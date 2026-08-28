'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCurrentConsentText } from '@/lib/api/fina-consent'

/**
 * "Read the consent text" — fetches the exact canonical text from the
 * backend (never a locally-duplicated copy) so what a guardian reads before
 * signing can never drift from what createConsent() actually hashes into
 * consent_text_hash.
 */
export function ConsentTextLink() {
  const t = useTranslations('fina.consent')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    setOpen(true)
    if (text !== null) return
    setLoading(true)
    const res = await getCurrentConsentText()
    setText(res.data?.text ?? t('error_generic'))
    setLoading(false)
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="text-xs text-[#022172] underline underline-offset-2">
        {t('read_text_link')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('read_text_link')}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700 leading-relaxed py-2">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('consent_text_loading')}
              </div>
            ) : (
              text
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
