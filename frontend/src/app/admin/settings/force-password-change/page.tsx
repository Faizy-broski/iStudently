'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getForcePasswordChangeStatus,
  forcePasswordChange,
  resetForcePasswordChange,
} from '@/lib/api/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Info, KeyRound, ShieldAlert, ShieldCheck, Loader2, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'

export default function ForcePasswordChangePage() {
  const [forcedCount, setForcedCount] = useState<number | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [forcing, setForcing] = useState(false)
  const [resetting, setResetting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await getForcePasswordChangeStatus()
      if (res.success && res.data != null) {
        setForcedCount(res.data.count)
      }
    } catch {
      // Non-critical; count stays null
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleForce = async () => {
    setForcing(true)
    try {
      const res = await forcePasswordChange()
      if (res.success && res.data != null) {
        setForcedCount(res.data.count)
        toast.success(
          res.data.count > 0
            ? `${res.data.count} user(s) must change their password on next login`
            : 'No users to update'
        )
      } else {
        toast.error(res.error ?? 'Failed to force password change')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setForcing(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      const res = await resetForcePasswordChange()
      if (res.success && res.data != null) {
        setForcedCount(0)
        toast.success(
          res.data.count > 0
            ? `Force requirement cleared for ${res.data.count} user(s)`
            : 'No users had the flag set'
        )
      } else {
        toast.error(res.error ?? 'Failed to reset')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <KeyRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Force Password Change
          </h1>
          <p className="text-muted-foreground">
            Require all users in this campus to set a new password on next login
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            Clicking <strong>Force Password Change</strong> sets a flag on every user account in
            this campus. The next time any of those users logs in they will be redirected to a
            mandatory password-change screen before they can access any page. Once they set a new
            password the flag is automatically cleared and they continue normally.
            <br />
            <strong>Reset</strong> removes the flag for everyone — users who have not yet logged in
            will no longer be required to change their password.
          </p>
          <p className="mt-2 font-medium">
            Note: super-admin accounts are never affected by this operation.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        {/* Status card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#022172]" />
              Current Status
            </CardTitle>
            <CardDescription>
              Users who are currently required to change their password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <span className="text-sm text-muted-foreground">Pending password changes</span>
              {loadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Badge
                  variant={forcedCount && forcedCount > 0 ? 'destructive' : 'secondary'}
                  className="text-base px-3 py-1"
                >
                  {forcedCount ?? 0}
                </Badge>
              )}
            </div>

            {forcedCount !== null && forcedCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{forcedCount}</strong> user{forcedCount !== 1 ? 's' : ''} will be
                  prompted to change password on next login.
                </span>
              </div>
            )}

            {forcedCount === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>No users are currently required to change their password.</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="w-full"
            >
              {loadingStatus
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing…</>
                : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh Status</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Actions card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#022172]" />
              Actions
            </CardTitle>
            <CardDescription>
              Apply or remove the force-password-change flag for all users in this campus
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Force */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={forcing || resetting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {forcing
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…</>
                    : <><ShieldAlert className="mr-2 h-4 w-4" /> Force Password Change</>
                  }
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Force Password Change for All Users?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every user in this campus (except super-admins) will be required to set a new
                    password the next time they log in. Active sessions are not affected — users
                    will see the prompt on their next login attempt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleForce}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Force Change
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reset */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={forcing || resetting || forcedCount === 0}
                  className="w-full"
                >
                  {resetting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…</>
                    : <><ShieldCheck className="mr-2 h-4 w-4" /> Reset (Remove Flag)</>
                  }
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Force Password Change Flag?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Users who have not yet changed their password will no longer be required to do
                    so. This is useful if you triggered a force-change accidentally or want to
                    re-allow access before all users have logged in.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    className="bg-[#022172] hover:bg-[#011558] text-white"
                  >
                    Reset Flag
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-muted-foreground">
              Campus-scoped: only users belonging to your current campus are affected.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
