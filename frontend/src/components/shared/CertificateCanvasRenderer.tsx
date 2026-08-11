'use client'

import Image from 'next/image'
import { GripVertical, ImageIcon } from 'lucide-react'
import type { CertificateTemplateConfig, CertificateTemplateField } from '@/lib/api/certificate-template'

/**
 * Replace every {{token}} occurrence in a string using the given data map.
 * Any token with no matching key is left blank (certificates read better empty than "N/A").
 * Mirrors backend/src/services/certificate-template.service.ts#substituteTokens.
 */
export function substituteTokens(template: string, data: Record<string, any>): string {
  let result = template
  Object.keys(data).forEach((key) => {
    const token = `{{${key}}}`
    const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : ''
    result = result.split(token).join(value)
  })
  return result.replace(/\{\{[^}]+\}\}/g, '')
}

interface CertificateCanvasRendererProps {
  layout: CertificateTemplateConfig['layout']
  design: CertificateTemplateConfig['design']
  fields: CertificateTemplateField[]
  /** Token substitution data. Omit to render raw field.token text (builder editing state). */
  data?: Record<string, any>
  /** Scales the whole canvas down (e.g. 0.25 for a gallery thumbnail) while keeping absolute px layout intact. */
  scale?: number
  selectedFieldId?: string | null
  interactive?: boolean
  onFieldMouseDown?: (e: React.MouseEvent, fieldId: string) => void
  onCanvasMouseMove?: (e: React.MouseEvent) => void
  onCanvasMouseUp?: () => void
  canvasRef?: React.Ref<HTMLDivElement>
  className?: string
}

export function CertificateCanvasRenderer({
  layout,
  design,
  fields,
  data,
  scale = 1,
  selectedFieldId = null,
  interactive = false,
  onFieldMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  canvasRef,
  className,
}: CertificateCanvasRendererProps) {
  return (
    <div
      style={{
        width: layout.width * scale,
        height: layout.height * scale,
        overflow: 'hidden',
      }}
      className={className}
    >
      <div
        ref={canvasRef}
        className={interactive ? 'relative shadow-2xl cursor-crosshair' : 'relative shadow-2xl'}
        style={{
          width: `${layout.width}px`,
          height: `${layout.height}px`,
          backgroundColor: design.backgroundColor,
          borderColor: design.borderColor,
          borderWidth: `${design.borderWidth}px`,
          borderStyle: 'solid',
          borderRadius: `${design.borderRadius}px`,
          backgroundImage: design.backgroundImage ? `url(${design.backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
        }}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
      >
        {fields.map((field) => {
          const isSelected = selectedFieldId === field.id
          const displayValue = data ? substituteTokens(field.token, data) : field.token

          if (field.type === 'image') {
            const isUrl = displayValue && (displayValue.startsWith('http') || displayValue.startsWith('data:'))
            return (
              <div
                key={field.id}
                className={`absolute border-2 ${interactive ? 'cursor-move' : ''} ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
                style={{
                  left: `${field.position.x}px`,
                  top: `${field.position.y}px`,
                  width: `${field.size.width}px`,
                  height: `${field.size.height}px`,
                }}
                onMouseDown={interactive ? (e) => onFieldMouseDown?.(e, field.id) : undefined}
              >
                {isUrl ? (
                  <Image
                    src={displayValue}
                    alt={field.label}
                    width={field.size.width}
                    height={field.size.height}
                    unoptimized
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-slate-800 rounded flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                {isSelected && <GripVertical className="absolute -top-2 -right-2 h-4 w-4 text-blue-500" />}
              </div>
            )
          }

          return (
            <div
              key={field.id}
              className={`absolute border-2 ${interactive ? 'cursor-move' : ''} ${isSelected ? 'border-blue-500' : 'border-transparent'}`}
              style={{
                left: `${field.position.x}px`,
                top: `${field.position.y}px`,
                width: `${field.size.width}px`,
                height: `${field.size.height}px`,
                fontSize: field.style?.fontSize ? `${field.style.fontSize}px` : '14px',
                fontWeight: field.style?.fontWeight || 'normal',
                color: field.style?.color || '#000000',
                textAlign: (field.style?.align as any) || 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent:
                  field.style?.align === 'center' ? 'center' : field.style?.align === 'right' ? 'flex-end' : 'flex-start',
                overflow: 'hidden',
                lineHeight: 1.3,
              }}
              onMouseDown={interactive ? (e) => onFieldMouseDown?.(e, field.id) : undefined}
            >
              <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue}</span>
              {isSelected && <GripVertical className="absolute -top-2 -right-2 h-4 w-4 text-blue-500" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
