'use client'

import * as React from 'react'
import QRCode from 'react-qr-code'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UserQRCodeProps {
  value: string
  size?: number
  label?: string
  showDownload?: boolean
}

export function UserQRCode({ value, size = 128, label, showDownload = true }: UserQRCodeProps) {
  const svgRef = React.useRef<HTMLDivElement>(null)

  const handleDownload = () => {
    const svg = svgRef.current?.querySelector('svg')
    if (!svg) return

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const canvas = document.createElement('canvas')
    const padding = 16
    canvas.width = size + padding * 2
    canvas.height = size + padding * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = `qr-${value.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = url
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={svgRef}
        className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm"
      >
        <QRCode value={value} size={size} />
      </div>
      {label && (
        <p className="text-xs text-gray-500 text-center max-w-[160px] truncate">{label}</p>
      )}
      {showDownload && (
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2 text-xs">
          <Download className="h-3.5 w-3.5" />
          Download QR
        </Button>
      )}
    </div>
  )
}
