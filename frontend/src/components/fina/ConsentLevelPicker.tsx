'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ConsentLevel, grantConsent, type Ward } from '@/lib/api/fina-consent'
import { ConsentTextLink } from './ConsentTextLink'

/**
 * The consent screen's [Change] dialog — spec §16.3, "the most important
 * screen in the module". Hard rules encoded directly in this component, not
 * left to convention:
 *   - All 5 options are rendered identically (same size, same styling) —
 *     the refusal option (DENY_ALL) must never look visually demoted.
 *   - Vocabulary is limited to plain language; no "level", no number, no
 *     technical term anywhere in the visible copy (see fina.consent.* i18n
 *     keys — every option's label/description is written in plain terms).
 *   - Narrowing (choosing a MORE restrictive option) applies instantly, no
 *     confirmation step. Widening (choosing a LESS restrictive option)
 *     requires one light confirmation click.
 */

const LEVEL_ORDER = [
  ConsentLevel.DENY_ALL,
  ConsentLevel.INNER_CIRCLE,
  ConsentLevel.CLASS_SCOPE,
  ConsentLevel.SCHOOL_SCOPE,
  ConsentLevel.SPECIAL_GRANT,
] as const

const LEVEL_KEY: Record<ConsentLevel, string> = {
  [ConsentLevel.DENY_ALL]: 'level_deny_all',
  [ConsentLevel.INNER_CIRCLE]: 'level_inner_circle',
  [ConsentLevel.CLASS_SCOPE]: 'level_class_scope',
  [ConsentLevel.SCHOOL_SCOPE]: 'level_school_scope',
  [ConsentLevel.SPECIAL_GRANT]: 'level_special_grant',
}

export function consentLevelLabel(t: ReturnType<typeof useTranslations>, level: ConsentLevel, name: string): string {
  return t(`${LEVEL_KEY[level]}_title`, { name })
}

interface ConsentLevelPickerProps {
  ward: Ward
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function ConsentLevelPicker({ ward, open, onOpenChange, onSaved }: ConsentLevelPickerProps) {
  const t = useTranslations('fina.consent')
  const name = [ward.firstName, ward.lastName].filter(Boolean).join(' ') || t('empty_wards')

  const [selected, setSelected] = useState<ConsentLevel>(ward.currentLevel)
  const [purpose, setPurpose] = useState('')
  const [confirmingWiden, setConfirmingWiden] = useState(false)
  const [saving, setSaving] = useState(false)

  const isWidening = selected > ward.currentLevel

  const reset = () => {
    setSelected(ward.currentLevel)
    setPurpose('')
    setConfirmingWiden(false)
  }

  const submit = async () => {
    if (selected === ConsentLevel.SPECIAL_GRANT && !purpose.trim()) {
      toast.error(t('purpose_required_error'))
      return
    }
    setSaving(true)
    try {
      const res = await grantConsent({
        student_id: ward.studentId,
        level: selected,
        purpose: selected === ConsentLevel.SPECIAL_GRANT ? purpose.trim() : undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('toast_saved', { name }))
        onOpenChange(false)
        reset()
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = () => {
    if (selected === ward.currentLevel) {
      onOpenChange(false)
      return
    }
    if (isWidening && !confirmingWiden) {
      setConfirmingWiden(true)
      return
    }
    submit()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{t('page_subtitle')}</DialogDescription>
        </DialogHeader>

        {confirmingWiden ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-700">{t('widen_confirm_body', { name })}</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <RadioGroup value={String(selected)} onValueChange={(v) => setSelected(Number(v) as ConsentLevel)}>
              {LEVEL_ORDER.map((level) => {
                const key = LEVEL_KEY[level]
                return (
                  <label
                    key={level}
                    htmlFor={`consent-level-${level}`}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 has-[:checked]:border-[#022172] has-[:checked]:bg-blue-50"
                  >
                    <RadioGroupItem value={String(level)} id={`consent-level-${level}`} className="mt-1" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-gray-900">{t(`${key}_title`, { name })}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{t(`${key}_desc`, { name })}</span>
                    </span>
                  </label>
                )
              })}
            </RadioGroup>

            {selected === ConsentLevel.SPECIAL_GRANT && (
              <div className="space-y-1.5">
                <Label>{t('purpose_label')}</Label>
                <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('purpose_placeholder')} rows={2} />
              </div>
            )}

            <ConsentTextLink />
          </div>
        )}

        <DialogFooter className="gap-2">
          {confirmingWiden && (
            <Button variant="outline" onClick={() => setConfirmingWiden(false)} disabled={saving}>
              {t('cancel_button')}
            </Button>
          )}
          <Button onClick={handleSaveClick} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmingWiden ? t('widen_confirm_confirm') : t('save_button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
