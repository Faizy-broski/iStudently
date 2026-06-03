'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Upload,
  X,
  Loader2,
  Check,
  LayoutDashboard,
  GraduationCap,
  Calendar,
  BookOpen,
  Settings,
  Users,
  ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SidebarConfig, UpdateSidebarConfigDTO } from '@/lib/api/sidebar-config'
import { uploadSidebarImage } from '@/lib/api/sidebar-config'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const MIN_WIDTH_PX = 200

interface ColorPreset {
  id: string
  color: string
  labelKey: string
}

const COLOR_PRESETS: ColorPreset[] = [
  { id: 'default_blue', color: '#022172', labelKey: 'preset_default_blue' },
  { id: 'deep_navy', color: '#0f172a', labelKey: 'preset_deep_navy' },
  { id: 'forest_green', color: '#14532d', labelKey: 'preset_forest_green' },
  { id: 'burgundy', color: '#6b1e1e', labelKey: 'preset_burgundy' },
  { id: 'charcoal', color: '#374151', labelKey: 'preset_charcoal' },
  { id: 'dark_teal', color: '#134e4a', labelKey: 'preset_dark_teal' },
  { id: 'royal_purple', color: '#3b0764', labelKey: 'preset_royal_purple' },
  { id: 'slate', color: '#1e293b', labelKey: 'preset_slate' },
]

// ─── Live Preview ─────────────────────────────────────────────────────────────

interface PreviewState {
  bg_color: string | null
  bg_image_url: string | null
  bg_image_opacity: number
}

function SidebarPreview({ state }: { state: PreviewState }) {
  const locale = useLocale()
  const isAr = locale === 'ar'

  const mockItems = [
    { icon: LayoutDashboard, label: isAr ? 'لوحة التحكم' : 'Dashboard', active: true },
    { icon: Users, label: isAr ? 'الطلاب' : 'Students', active: false },
    { icon: GraduationCap, label: isAr ? 'الأكاديمية' : 'Academics', active: false },
    { icon: Calendar, label: isAr ? 'الجدول' : 'Timetable', active: false },
    { icon: BookOpen, label: isAr ? 'المكتبة' : 'Library', active: false },
    { icon: Settings, label: isAr ? 'الإعدادات' : 'Settings', active: false },
  ]

  const sidebarStyle: React.CSSProperties = state.bg_color
    ? { background: state.bg_color }
    : { background: 'linear-gradient(180deg, #57A3CC 0%, #022172 100%)' }

  return (
    <div
      className="relative w-[188px] h-[360px] rounded-xl overflow-hidden shadow-2xl ring-2 ring-black/10 flex-shrink-0 select-none"
      style={sidebarStyle}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Default decorative overlay */}
      {!state.bg_image_url && (
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: 'url(/images/sidebar-bg.svg)' }}
        />
      )}

      {/* Custom image overlay */}
      {state.bg_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: `url(${state.bg_image_url})`,
            opacity: state.bg_image_opacity,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-3">
        {/* Logo area */}
        <div className="mb-3 pb-3 border-b border-white/20">
          <div className="w-11 h-8 bg-white/20 rounded-lg mx-auto" />
          <div className="mt-1.5 h-2 bg-white/30 rounded w-3/4 mx-auto" />
          <div className="mt-1 h-1.5 bg-white/20 rounded w-1/2 mx-auto" />
        </div>

        {/* Nav items */}
        <div className="space-y-0.5 flex-1">
          {mockItems.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-l-full text-[11px]',
                  item.active
                    ? 'bg-white text-[#022172] font-semibold shadow-sm'
                    : 'text-white/80'
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.active && (
                  <div className="ms-auto w-1.5 h-1.5 bg-[#EEA831] rounded-full" />
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/20 text-center">
          <span className="text-white/30 text-[8px]">iStudently</span>
        </div>
      </div>
    </div>
  )
}

// ─── Image Upload Section ─────────────────────────────────────────────────────

interface ImageUploadSectionProps {
  imageUrl: string | null
  opacity: number
  uploadScope: string
  onImageChange: (url: string | null) => void
  onOpacityChange: (value: number) => void
}

function ImageUploadSection({
  imageUrl,
  opacity,
  uploadScope,
  onImageChange,
  onOpacityChange,
}: ImageUploadSectionProps) {
  const t = useTranslations('sidebarConfig')
  const [isUploading, setIsUploading] = React.useState(false)
  const [imageFile, setImageFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const changeInputRef = React.useRef<HTMLInputElement>(null)

  // Check image dimensions — shows warnings but does NOT block upload
  const checkDimensions = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve) => {
      if (file.type === 'image/svg+xml') {
        resolve({ width: 999, height: 999 })
        return
      }
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        resolve({ width: 999, height: 999 })
        URL.revokeObjectURL(url)
      }
      img.src = url
    })

  const processFile = async (file: File) => {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPG, PNG, SVG, WebP')
      return
    }
    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File too large. Maximum size is 2MB')
      return
    }

    // Check dimensions and show warnings (non-blocking)
    const { width, height } = await checkDimensions(file)
    if (width < MIN_WIDTH_PX) {
      toast.warning(t('warn_small'))
    } else if (width > height * 2) {
      toast.warning(t('warn_landscape'))
    }

    setIsUploading(true)
    const result = await uploadSidebarImage(file, uploadScope)
    setIsUploading(false)

    if (!result.success || !result.url) {
      toast.error(result.error || 'Upload failed')
      return
    }

    setImageFile(file)
    onImageChange(result.url)
    toast.success('Image uploaded successfully')

    // Reset inputs so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (changeInputRef.current) changeInputRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleRemove = () => {
    setImageFile(null)
    onImageChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (changeInputRef.current) changeInputRef.current.value = ''
  }

  // Drop handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-5">
      {/* ── Upload / Preview area ── */}
      {!imageUrl ? (
        // Empty state — dashed drag-and-drop area
        <label
          htmlFor="sidebar-image-upload"
          className={cn(
            'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
            'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-[#57A3CC]',
            isUploading && 'opacity-60 cursor-not-allowed pointer-events-none'
          )}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-[#57A3CC] animate-spin" />
              <p className="text-sm text-gray-500">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 text-center">
              <Upload className="h-8 w-8 text-gray-400 mb-1" />
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-[#57A3CC]">Click to upload</span>
                {' '}or drag and drop
              </p>
              <p className="text-xs text-gray-400">{t('image_formats')}</p>
              <p className="text-xs text-gray-400">{t('image_hint')}</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            id="sidebar-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/svg+xml,image/webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      ) : (
        // Preview state — shows thumbnail with filename and actions
        <div className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl bg-gray-50">
          {/* Thumbnail */}
          <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-white flex-shrink-0">
            <img
              src={imageUrl}
              alt="Background preview"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info & actions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <ImageIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <p className="text-sm font-medium text-gray-700 truncate">
                {imageFile ? imageFile.name : 'Sidebar background'}
              </p>
            </div>
            {imageFile && (
              <p className="text-xs text-gray-400 mb-2">
                {(imageFile.size / 1024).toFixed(0)} KB
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {/* Change image */}
              <label htmlFor="sidebar-image-change" className="cursor-pointer">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-[#57A3CC] border-[#57A3CC]/40 hover:bg-[#57A3CC]/5 h-7 text-xs"
                  asChild
                >
                  <span>
                    {isUploading ? (
                      <><Loader2 className="h-3 w-3 me-1 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-3 w-3 me-1" />Change</>
                    )}
                  </span>
                </Button>
                <input
                  ref={changeInputRef}
                  id="sidebar-image-change"
                  type="file"
                  accept="image/jpeg,image/png,image/svg+xml,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              {/* Remove */}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 text-xs"
                disabled={isUploading}
              >
                <X className="h-3 w-3 me-1" />
                {t('remove_image')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Opacity slider ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-700">
            {t('opacity_label')}
          </Label>
          <span className="text-sm font-mono text-gray-500 tabular-nums">
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Visual opacity track */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            disabled={!imageUrl}
            className={cn(
              'w-full h-2 rounded-full appearance-none cursor-pointer',
              'accent-[#022172]',
              !imageUrl && 'opacity-40 cursor-not-allowed'
            )}
            style={{
              background: `linear-gradient(to right, #022172 0%, #022172 ${opacity * 100}%, #e5e7eb ${opacity * 100}%, #e5e7eb 100%)`,
            }}
          />
        </div>
        {!imageUrl && (
          <p className="text-xs text-gray-400">Upload an image to adjust opacity</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export interface SidebarConfigEditorProps {
  initialConfig: SidebarConfig | null
  uploadScope: string // 'superadmin' or school_id
  onSave: (dto: UpdateSidebarConfigDTO) => Promise<void>
  onReset?: () => Promise<void>
  isSaving?: boolean
  showResetButton?: boolean
  infoAlert?: string
}

export function SidebarConfigEditor({
  initialConfig,
  uploadScope,
  onSave,
  onReset,
  isSaving = false,
  showResetButton = false,
  infoAlert,
}: SidebarConfigEditorProps) {
  const t = useTranslations('sidebarConfig')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [bgColor, setBgColor] = React.useState<string | null>(
    initialConfig?.bg_color ?? null
  )
  const [bgImageUrl, setBgImageUrl] = React.useState<string | null>(
    initialConfig?.bg_image_url ?? null
  )
  const [bgImageOpacity, setBgImageOpacity] = React.useState<number>(
    initialConfig?.bg_image_opacity ?? 0.15
  )
  const [hexInput, setHexInput] = React.useState<string>(
    initialConfig?.bg_color ?? '#022172'
  )

  // Sync state when initialConfig arrives (after fetch)
  React.useEffect(() => {
    setBgColor(initialConfig?.bg_color ?? null)
    setBgImageUrl(initialConfig?.bg_image_url ?? null)
    setBgImageOpacity(initialConfig?.bg_image_opacity ?? 0.15)
    setHexInput(initialConfig?.bg_color ?? '#022172')
  }, [initialConfig])

  const previewState: PreviewState = {
    bg_color: bgColor,
    bg_image_url: bgImageUrl,
    bg_image_opacity: bgImageOpacity,
  }

  const handleColorPreset = (color: string) => {
    setBgColor(color)
    setHexInput(color)
  }

  const handleHexInput = (value: string) => {
    setHexInput(value)
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setBgColor(value)
    }
  }

  const handleNativePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBgColor(e.target.value)
    setHexInput(e.target.value)
  }

  const handleClearColor = () => {
    setBgColor(null)
    setHexInput('#022172')
  }

  const handleSave = async () => {
    await onSave({
      bg_color: bgColor,
      bg_image_url: bgImageUrl,
      bg_image_opacity: bgImageOpacity,
    })
  }

  return (
    <div
      className="flex flex-col xl:flex-row gap-6"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ── Left: controls ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {infoAlert && (
          <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            <span className="text-blue-500 mt-0.5 text-base leading-none">ℹ</span>
            <span>{infoAlert}</span>
          </div>
        )}

        <Tabs defaultValue="color">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="color" className="text-sm">
              {t('tab_color')}
            </TabsTrigger>
            <TabsTrigger value="image" className="text-sm">
              {t('tab_image')}
            </TabsTrigger>
          </TabsList>

          {/* ── Color Tab ── */}
          <TabsContent value="color" className="space-y-5 pt-5">
            {/* Preset swatches */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {t('preset_colors')}
              </Label>
              <div className="grid grid-cols-4 gap-2.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={t(preset.labelKey)}
                    onClick={() => handleColorPreset(preset.color)}
                    className={cn(
                      'relative h-11 rounded-xl ring-2 transition-all duration-150 shadow-sm',
                      bgColor === preset.color
                        ? 'ring-[#EEA831] scale-105 shadow-md'
                        : 'ring-transparent hover:ring-gray-300 hover:scale-105'
                    )}
                    style={{ background: preset.color }}
                  >
                    {bgColor === preset.color && (
                      <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                    )}
                    <span className="sr-only">{t(preset.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {t('custom_color')}
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={bgColor ?? '#022172'}
                    onChange={handleNativePicker}
                    className="h-10 w-12 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
                    title="Pick a color"
                  />
                </div>
                <Input
                  value={hexInput}
                  onChange={(e) => handleHexInput(e.target.value)}
                  placeholder={t('hex_input_placeholder')}
                  className="flex-1 font-mono text-sm border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                  maxLength={7}
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearColor}
                  disabled={!bgColor}
                  className="shrink-0 border-gray-300 text-gray-600"
                >
                  {t('clear_color')}
                </Button>
              </div>
              <p className="text-xs text-gray-400">{t('clear_color_hint')}</p>
            </div>
          </TabsContent>

          {/* ── Image Tab ── */}
          <TabsContent value="image" className="pt-5">
            <ImageUploadSection
              imageUrl={bgImageUrl}
              opacity={bgImageOpacity}
              uploadScope={uploadScope}
              onImageChange={setBgImageUrl}
              onOpacityChange={setBgImageOpacity}
            />
          </TabsContent>
        </Tabs>

        {/* ── Save / Reset ── */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 gradient-blue text-white border-0 font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </Button>
          {showResetButton && onReset && (
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={isSaving}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {t('reset_defaults')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Right: live preview ── */}
      <div className="flex flex-col items-center gap-3 xl:w-52 shrink-0">
        <Label className="text-sm font-semibold text-gray-600">
          {t('live_preview')}
        </Label>
        <SidebarPreview state={previewState} />
        {/* Color swatch under preview */}
        {bgColor && (
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-200 shadow-sm"
              style={{ background: bgColor }}
            />
            <span className="text-xs font-mono text-gray-500">{bgColor}</span>
          </div>
        )}
      </div>
    </div>
  )
}
