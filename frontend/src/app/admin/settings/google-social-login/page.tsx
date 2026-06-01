'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSocialLoginSettings, updateSocialLoginSettings } from '@/lib/api/school-settings'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Info, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function GoogleSocialLoginPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null

  const [enabled, setEnabled] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [hostedDomain, setHostedDomain] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSocialLoginSettings(campusId)
      if (result.success && result.data) {
        setEnabled(result.data.google_enabled)
        setClientId(result.data.google_client_id || '')
        setClientSecret(result.data.google_client_secret || '')
        setHasSecret(result.data.has_google_secret)
        setHostedDomain(result.data.google_hosted_domain || '')
      }
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [campusId])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const handleSave = async () => {
    if (enabled && !clientId.trim()) {
      toast.error('Client ID is required when Google login is enabled')
      return
    }
    if (enabled && !hasSecret && !clientSecret.trim()) {
      toast.error('Client Secret is required when Google login is enabled')
      return
    }

    setSaving(true)
    try {
      const result = await updateSocialLoginSettings({
        google_enabled: enabled,
        google_client_id: clientId.trim(),
        google_client_secret: clientSecret,
        google_hosted_domain: hostedDomain.trim(),
      }, campusId)

      if (result.success) {
        toast.success('Google Social Login settings saved')
        await loadConfig()
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-75">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="py-6 px-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shrink-0">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">Google Social Login</h1>
          <p className="text-sm text-muted-foreground">
            Allow users to sign in with their Google account. Only users with existing profiles can log in.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="flex gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-2">
          <p className="font-medium">Setup Instructions</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <span className="font-medium">Google Cloud Console → APIs &amp; Services → Credentials</span></li>
            <li>Create an <span className="font-medium">OAuth 2.0 Client ID</span> (Web application)</li>
            <li>
              Add the following as an <span className="font-medium">Authorized redirect URI</span>:
              <code className="block mt-1 px-2 py-1 bg-blue-100 rounded text-xs break-all">
                {typeof window !== 'undefined'
                  ? `${window.location.origin.replace(/:\d+$/, ':5000')}/api/auth/social/google/callback`
                  : 'https://your-backend-url/api/auth/social/google/callback'}
              </code>
            </li>
            <li>Copy the <span className="font-medium">Client ID</span> and <span className="font-medium">Client Secret</span> and paste them below</li>
          </ol>
        </div>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enable Google Login</CardTitle>
              <CardDescription>Show &quot;Continue with Google&quot; button on the login page</CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardHeader>
      </Card>

      {/* OAuth Credentials */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OAuth Credentials</CardTitle>
            <CardDescription>Enter the credentials from your Google Cloud Console project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Client ID</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                className="mt-1.5 font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-sm">Client Secret</Label>
              <div className="relative mt-1.5">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSecret ? '••••••••  (saved — enter new value to change)' : 'Enter client secret'}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {hasSecret && (
                <p className="text-xs text-muted-foreground mt-1">
                  A secret is already saved. Leave empty to keep the current one.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domain Restriction */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Domain Restriction</CardTitle>
            <CardDescription>Limit which Google accounts can sign in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Google Workspace Domain (Optional)</Label>
                <Input
                  value={hostedDomain}
                  onChange={(e) => setHostedDomain(e.target.value)}
                  placeholder="e.g. school.edu"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Only Google accounts from this domain will be allowed to sign in.
                  Leave empty to allow any Google account.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Important:</span> Even with domain restriction,
                  users must have an existing profile in the system. Google login does not create new accounts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
              <li>User clicks &quot;Continue with Google&quot; on the login page</li>
              <li>Google authenticates the user and returns their email</li>
              <li>The system looks up a profile matching that email</li>
              <li>If found, the user is signed in and redirected to their dashboard</li>
              <li>If not found, a &quot;No account found&quot; message is shown</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#022172] hover:bg-[#022172]/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
