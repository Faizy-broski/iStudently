'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { uploadImage } from '@/lib/api/media-upload'
import { toast } from 'sonner'

const FILE_SIZE_LIMIT = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

interface ImageDropzoneProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  hint?: string
  /** Optional aspect-ratio hint for the preview box, e.g. "16/9" or "1/1" */
  aspectRatio?: string
  className?: string
}

/**
 * Drag-and-drop image uploader. Accepts a drop or a click-to-browse file, uploads it via the
 * generic backend-mediated /media/upload-image endpoint, and reports back the resulting public URL.
 */
export function ImageDropzone({ value, onChange, label, hint, aspectRatio = '16/9', className }: ImageDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const validateFile = (f: File): boolean => {
    if (f.size > FILE_SIZE_LIMIT) {
      toast.error(`Image too large (max 5 MB)`)
      return false
    }
    if (ACCEPTED_TYPES.length > 0 && !ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Unsupported image type. Use JPG, PNG, WEBP, or SVG.')
      return false
    }
    return true
  }

  const doUpload = async (file: File) => {
    if (!validateFile(file)) return
    setIsUploading(true)
    try {
      const res = await uploadImage(file)
      if (res.success && res.data?.url) {
        onChange(res.data.url)
      } else {
        toast.error(res.error || 'Upload failed')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) doUpload(dropped)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) doUpload(selected)
  }

  const clear = () => {
    onChange('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleSelect}
        accept={ACCEPTED_TYPES.join(',')}
      />

      {value ? (
        <div className="relative rounded-lg border overflow-hidden group" style={{ aspectRatio }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label || 'Uploaded image'} className="w-full h-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={clear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
          )}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {isUploading ? 'Uploading…' : (
              <>Drop an image here or <span className="text-primary">browse</span></>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{hint || 'JPG, PNG, WEBP, SVG — Max 5 MB'}</p>
        </div>
      )}
    </div>
  )
}

/** Small inline icon placeholder used where an image field has no value yet */
export function ImagePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('w-full h-full bg-gray-200 dark:bg-slate-800 rounded flex items-center justify-center', className)}>
      <ImageIcon className="h-6 w-6 text-gray-400" />
    </div>
  )
}
