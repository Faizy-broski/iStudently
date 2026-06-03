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

export default function MicrosoftSocialLoginPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null

  const [enabled, setEnabled] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [tenant, setTenant] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSocialLoginSettings(campusId)
      if (result.success && result.data) {
        setEnabled(result.data.microsoft_enabled)
        setClientId(result.data.microsoft_client_id || '')
        setClientSecret(result.data.microsoft_client_secret || '')
        setHasSecret(result.data.has_microsoft_secret)
        setTenant(result.data.microsoft_tenant || '')
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
      toast.error('Application (Client) ID is required when Microsoft login is enabled')
      return
    }
    if (enabled && !hasSecret && !clientSecret.trim()) {
      toast.error('Client Secret is required when Microsoft login is enabled')
      return
    }

    setSaving(true)
    try {
      const result = await updateSocialLoginSettings({
        microsoft_enabled: enabled,
        microsoft_client_id: clientId.trim(),
        microsoft_client_secret: clientSecret,
        microsoft_tenant: tenant.trim(),
      }, campusId)

      if (result.success) {
        toast.success('Microsoft Social Login settings saved')
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
          <svg className="h-5 w-5" viewBox="0 0 23 23">
            <rect fill="#F25022" x="1" y="1" width="10" height="10" />
            <rect fill="#00A4EF" x="1" y="12" width="10" height="10" />
            <rect fill="#7FBA00" x="12" y="1" width="10" height="10" />
            <rect fill="#FFB900" x="12" y="12" width="10" height="10" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#022172]">Microsoft Social Login</h1>
          <p className="text-sm text-muted-foreground">
            Allow users to sign in with their Microsoft account. Only users with existing profiles can log in.
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="flex gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-2">
          <p className="font-medium">Setup Instructions</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <span className="font-medium">Azure Portal → Microsoft Entra ID → App registrations</span></li>
            <li>Click <span className="font-medium">New registration</span> and choose supported account types</li>
            <li>
              Set the redirect URI (Web) to:
              <code className="block mt-1 px-2 py-1 bg-blue-100 rounded text-xs break-all">
                {typeof window !== 'undefined'
                  ? `${window.location.origin.replace(/:\d+$/, ':5000')}/api/auth/social/microsoft/callback`
                  : 'https://your-backend-url/api/auth/social/microsoft/callback'}
              </code>
            </li>
            <li>Go to <span className="font-medium">Certificates &amp; secrets → New client secret</span></li>
            <li>Copy the <span className="font-medium">Application (Client) ID</span> and <span className="font-medium">Client Secret Value</span> and paste them below</li>
          </ol>
        </div>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enable Microsoft Login</CardTitle>
              <CardDescription>Show &quot;Continue with Microsoft&quot; button on the login page</CardDescription>
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
            <CardDescription>Enter the credentials from your Azure Portal app registration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Application (Client) ID</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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
                  placeholder={hasSecret ? '••••••••  (saved — enter new value to change)' : 'Enter client secret value'}
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

      {/* Tenant Restriction */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant Restriction</CardTitle>
            <CardDescription>Control which Microsoft accounts can sign in</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Azure AD Tenant (Optional)</Label>
                <Input
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  placeholder="e.g. organizations or tenant-id"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Restrict login to a specific Azure AD tenant. Common values:
                </p>
                <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc space-y-0.5">
                  <li><code className="bg-muted px-1 rounded">organizations</code> — all work/school Microsoft accounts</li>
                  <li><code className="bg-muted px-1 rounded">common</code> — all Microsoft accounts (work + personal)</li>
                  <li><code className="bg-muted px-1 rounded">consumers</code> — personal Microsoft accounts only</li>
                  <li>A specific <span className="font-medium">Tenant ID</span> — restricts to one Azure AD organization</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty to default to <code className="bg-muted px-1 rounded">common</code> (all Microsoft accounts).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Important:</span> Even with tenant restriction,
                  users must have an existing profile in the system. Microsoft login does not create new accounts.
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
              <li>User clicks &quot;Continue with Microsoft&quot; on the login page</li>
              <li>Microsoft authenticates the user and returns their email</li>
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
