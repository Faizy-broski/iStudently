'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Palette,
  Loader2,
  Upload,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/context/AuthContext'
import {
  getLoginPageConfig,
  updateLoginPageConfig,
  resetLoginPageConfig,
  uploadLoginPageImage,
  DEFAULT_LOGIN_PAGE_CONFIG,
  type LoginPageConfig,
} from '@/lib/api/login-page-config'

const OFFSET_STEP = 10
const MAX_OFFSET = 200
const MIN_FORM_WIDTH = 320
const MAX_FORM_WIDTH = 640

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

function LoginPreview({ config }: { config: LoginPageConfig }) {
  const rightBg: React.CSSProperties =
    config.background_type === 'image' && config.background_image_url
      ? {
          backgroundImage: `url(${config.background_image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : config.background_type === 'color'
      ? { background: config.background_color }
      : { background: `linear-gradient(to right, ${config.gradient_from}, ${config.gradient_to})` }

  const scale = 260 / config.form_width

  return (
    <div className="relative w-full max-w-[420px] aspect-[16/10] rounded-xl overflow-hidden shadow-2xl ring-2 ring-black/10 flex select-none">
      <div className="w-1/2 bg-white flex flex-col items-center justify-center gap-2 p-4">
        <img src="/images/logo.png" alt="logo" className="w-10 h-10 object-contain" />
        <p className="text-xs font-semibold text-center" style={{ color: config.text_color_left }}>
          Welcome Back
        </p>
      </div>
      <div className="w-1/2 relative overflow-hidden" style={rightBg}>
        {config.background_type === 'image' && config.background_image_url && (
          <div
            className="absolute inset-0"
            style={{ background: '#000', opacity: 1 - config.background_image_opacity }}
          />
        )}
        <div
          className="absolute rounded-lg bg-white/10 border border-white/20 p-3 flex flex-col items-center justify-center gap-1.5"
          style={{
            width: Math.min(config.form_width * scale, 140),
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${config.form_offset_x * scale}px), calc(-50% + ${config.form_offset_y * scale}px))`,
          }}
        >
          <p className="text-[10px] font-semibold" style={{ color: config.text_color_right }}>
            Sign In
          </p>
          <div className="w-full h-2 rounded bg-white/20" />
          <div className="w-full h-2 rounded bg-white/20" />
          <div className="w-3/4 h-2 rounded bg-white/40" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPageAppearanceSettingsPage() {
  const { profile } = useAuth()
  const router = useRouter()

  const [config, setConfig] = React.useState<LoginPageConfig>(DEFAULT_LOGIN_PAGE_CONFIG)
  const [loading, setLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadingBg, setUploadingBg] = React.useState(false)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)

  React.useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      router.replace(`/${profile.role}/dashboard`)
    }
  }, [profile, router])

  React.useEffect(() => {
    let mounted = true
    getLoginPageConfig()
      .then((data) => {
        if (mounted) setConfig(data)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const patch = (updates: Partial<LoginPageConfig>) =>
    setConfig((prev) => ({ ...prev, ...updates }))

  const nudge = (dx: number, dy: number) => {
    patch({
      form_offset_x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, config.form_offset_x + dx)),
      form_offset_y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, config.form_offset_y + dy)),
    })
  }

  const handleBgImageUpload = async (file: File) => {
    setUploadingBg(true)
    const result = await uploadLoginPageImage(file, 'background')
    setUploadingBg(false)
    if (!result.success || !result.url) {
      toast.error(result.error || 'Upload failed')
      return
    }
    patch({ background_image_url: result.url })
    toast.success('Background image uploaded')
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    const result = await uploadLoginPageImage(file, 'logo')
    setUploadingLogo(false)
    if (!result.success || !result.url) {
      toast.error(result.error || 'Upload failed')
      return
    }
    patch({ logo_url: result.url })
    toast.success('Logo uploaded')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateLoginPageConfig(config)
      if (result.success) {
        if (result.data) setConfig(result.data)
        toast.success('Login page settings saved')
      } else {
        toast.error(result.error || 'Save failed')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    setIsSaving(true)
    try {
      const result = await resetLoginPageConfig()
      if (result.success && result.data) {
        setConfig(result.data)
        toast.success('Login page settings reset to defaults')
      } else {
        toast.error(result.error || 'Reset failed')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (profile && profile.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl gradient-blue flex items-center justify-center shrink-0 shadow-md">
          <Palette className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Login Page Appearance
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Customize the background, colors, position and size of the platform login page
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          <p className="text-sm text-gray-400">Loading configuration...</p>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            {/* Background */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Background</CardTitle>
                <CardDescription>Choose a gradient, solid color, or an image</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={config.background_type}
                  onValueChange={(v) => patch({ background_type: v as LoginPageConfig['background_type'] })}
                >
                  <TabsList className="grid w-full grid-cols-3 h-10">
                    <TabsTrigger value="gradient">Gradient</TabsTrigger>
                    <TabsTrigger value="color">Solid Color</TabsTrigger>
                    <TabsTrigger value="image">Image</TabsTrigger>
                  </TabsList>

                  <TabsContent value="gradient" className="pt-5 space-y-4">
                    <ColorField
                      label="From"
                      value={config.gradient_from}
                      onChange={(v) => patch({ gradient_from: v })}
                    />
                    <ColorField
                      label="To"
                      value={config.gradient_to}
                      onChange={(v) => patch({ gradient_to: v })}
                    />
                  </TabsContent>

                  <TabsContent value="color" className="pt-5">
                    <ColorField
                      label="Background Color"
                      value={config.background_color}
                      onChange={(v) => patch({ background_color: v })}
                    />
                  </TabsContent>

                  <TabsContent value="image" className="pt-5 space-y-4">
                    {config.background_image_url ? (
                      <div className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-white shrink-0">
                          <img
                            src={config.background_image_url}
                            alt="Background"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => patch({ background_image_url: null })}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="h-3 w-3 me-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100">
                        {uploadingBg ? (
                          <Loader2 className="h-6 w-6 animate-spin text-[#57A3CC]" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-gray-400 mb-1" />
                            <span className="text-sm text-gray-600">Click to upload</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingBg}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleBgImageUpload(file)
                          }}
                        />
                      </label>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-gray-700">Overlay Darkness</Label>
                        <span className="text-sm font-mono text-gray-500">
                          {Math.round((1 - config.background_image_opacity) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={config.background_image_opacity}
                        onChange={(e) => patch({ background_image_opacity: parseFloat(e.target.value) })}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#022172]"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Text Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Text Colors</CardTitle>
                <CardDescription>Match the sidebar or use your own brand colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField
                  label="Left Panel Text (heading/subtitle)"
                  value={config.text_color_left}
                  onChange={(v) => patch({ text_color_left: v })}
                />
                <ColorField
                  label="Right Panel Text (form)"
                  value={config.text_color_right}
                  onChange={(v) => patch({ text_color_right: v })}
                />
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Logo</CardTitle>
                <CardDescription>Override the default logo shown on the login page</CardDescription>
              </CardHeader>
              <CardContent>
                {config.logo_url ? (
                  <div className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white shrink-0 flex items-center justify-center">
                      <img src={config.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => patch({ logo_url: null })}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-3 w-3 me-1" />
                      Use Default
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100">
                    {uploadingLogo ? (
                      <Loader2 className="h-6 w-6 animate-spin text-[#57A3CC]" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400 mb-1" />
                        <span className="text-sm text-gray-600">Click to upload logo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      className="hidden"
                      disabled={uploadingLogo}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleLogoUpload(file)
                      }}
                    />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* Position & Size */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Form Position &amp; Size</CardTitle>
                <CardDescription>Nudge the login form card and adjust its width</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-6">
                  <div className="grid grid-cols-3 gap-1.5 w-32">
                    <div />
                    <Button type="button" variant="outline" size="icon" onClick={() => nudge(0, -OFFSET_STEP)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <div />
                    <Button type="button" variant="outline" size="icon" onClick={() => nudge(-OFFSET_STEP, 0)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px]"
                      onClick={() => patch({ form_offset_x: 0, form_offset_y: 0 })}
                    >
                      Reset
                    </Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => nudge(OFFSET_STEP, 0)}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <div />
                    <Button type="button" variant="outline" size="icon" onClick={() => nudge(0, OFFSET_STEP)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <div />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Horizontal offset (px)</Label>
                      <Input
                        type="number"
                        value={config.form_offset_x}
                        onChange={(e) =>
                          patch({
                            form_offset_x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, parseInt(e.target.value) || 0)),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-500">Vertical offset (px)</Label>
                      <Input
                        type="number"
                        value={config.form_offset_y}
                        onChange={(e) =>
                          patch({
                            form_offset_y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, parseInt(e.target.value) || 0)),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700">Form Width</Label>
                    <span className="text-sm font-mono text-gray-500">{config.form_width}px</span>
                  </div>
                  <input
                    type="range"
                    min={MIN_FORM_WIDTH}
                    max={MAX_FORM_WIDTH}
                    step={8}
                    value={config.form_width}
                    onChange={(e) => patch({ form_width: parseInt(e.target.value) })}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#022172]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save / Reset */}
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 gradient-blue text-white border-0 font-semibold"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
                Reset to Default
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex flex-col items-center gap-3 xl:w-[440px] shrink-0">
            <Label className="text-sm font-semibold text-gray-600">Live Preview</Label>
            <LoginPreview config={config} />
          </div>
        </div>
      )}
    </div>
  )
}
