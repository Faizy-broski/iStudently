'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { MessageSquarePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { submitFeedback } from '@/lib/api/feedback'

export function FeedbackWidget() {
  const t = useTranslations('feedbackWidget')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'feature_request' | 'bug'>('bug')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error(t('validationError'))
      return
    }
    setSubmitting(true)
    try {
      const res = await submitFeedback({ title: title.trim(), description: description.trim(), category })
      if (!res.success) {
        toast.error(res.error || t('submitFailed'))
        return
      }
      toast.success(t('submitSuccess'))
      setTitle('')
      setDescription('')
      setCategory('bug')
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 rounded-full bg-[#022172] text-white shadow-lg px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-[#01154d] transition-colors"
        title={t('buttonTooltip')}
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">{t('buttonLabel')}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir={isAr ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-category">{t('category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as 'feature_request' | 'bug')}>
                <SelectTrigger id="feedback-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature_request">{t('featureRequest')}</SelectItem>
                  <SelectItem value="bug">{t('bug')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-title">{t('title')}</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-description">{t('description')}</Label>
              <Textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={5}
                maxLength={5000}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
