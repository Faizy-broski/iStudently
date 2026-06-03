'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Copy, Check, Printer, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { regenerateCredentials } from '@/lib/api/credentials'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface CredentialsCardProps {
  profileId: string
  profileName: string
  username: string | null
  plainPassword?: string | null
}

export function CredentialsCard({
  profileId,
  profileName,
  username: initialUsername,
  plainPassword: initialPlainPassword,
}: CredentialsCardProps) {
  const t = useTranslations('credentials')
  const [username, setUsername] = useState(initialUsername)
  const [plainPassword, setPlainPassword] = useState(initialPlainPassword ?? null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [iCopied, setICopied] = useState(false)

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Copy failed')
    }
  }

  const copyAll = () => {
    const lines = [
      `${t('username')}: ${username ?? ''}`,
      `${t('password')}: ${plainPassword ?? ''}`,
    ]
    copy(lines.join('\n'), 'all')
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await regenerateCredentials(profileId)
      if (!res.success || !res.data) {
        toast.error(res.error ?? 'Failed to regenerate')
        return
      }
      setUsername(res.data.username)
      setPlainPassword(res.data.plainPassword ?? null)
      setShowPassword(true)
      setICopied(false)
      toast.success(t('regenerateSuccess', { name: profileName }))
    } catch {
      toast.error('Failed to regenerate credentials')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-base">{t('sectionTitle')}</h3>

      {/* Username */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-24 shrink-0">{t('username')}</span>
        <code className="flex-1 font-mono text-sm bg-muted px-2 py-1.5 rounded truncate">
          {username ?? '—'}
        </code>
        {username && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => copy(username, 'username')}
          >
            {copied === 'username' ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Password */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-24 shrink-0">{t('password')}</span>
        {plainPassword ? (
          <>
            <code className="flex-1 font-mono text-sm bg-muted px-2 py-1.5 rounded truncate">
              {showPassword ? plainPassword : '••••••••••'}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => copy(plainPassword, 'password')}
            >
              {copied === 'password' ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">{t('passwordNotAvailable')}</span>
        )}
      </div>

      {/* Amber warning */}
      {plainPassword && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{t('passwordWarning')}</p>
        </div>
      )}

      {/* "I have copied" checkbox */}
      {plainPassword && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={iCopied}
            onChange={(e) => setICopied(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm">{t('iCopied')}</span>
        </label>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {plainPassword && (
          <Button variant="outline" size="sm" onClick={copyAll}>
            {copied === 'all' ? (
              <>
                <Check className="h-3.5 w-3.5 me-1.5 text-green-500" />
                {t('copied')}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 me-1.5" />
                {t('copyAll')}
              </>
            )}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 me-1.5" />
          {t('print')}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700"
            >
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              {t('regenerate')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('regenerateConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('regenerateConfirmDesc', { name: profileName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? t('regenerating') : t('regenerateConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
