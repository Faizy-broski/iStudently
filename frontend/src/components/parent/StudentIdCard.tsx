'use client'

import { useState, useRef } from 'react'
import { useStudentIdCard } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Download, Printer, RefreshCw, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'

export function StudentIdCard() {
  const { idCard, isLoading, error, refresh } = useStudentIdCard()
  const [isDownloading, setIsDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    if (!cardRef.current) return
    
    setIsDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      })
      
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `student-id-card-${idCard?.student_data['{{student_number}}'] || 'card'}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      // Download failed - silent
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Skeleton className="w-[350px] h-[220px] rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 mb-4">Failed to load ID card</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!idCard?.template_config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">
              ID card template not available.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Please contact the school administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const config = idCard.template_config

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Student ID Card
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div 
          ref={cardRef}
          className="relative shadow-xl print:shadow-none"
          style={{
            width: `${config.layout.width}px`,
            height: `${config.layout.height}px`,
            backgroundColor: config.design.backgroundColor,
            borderColor: config.design.borderColor,
            borderWidth: `${config.design.borderWidth}px`,
            borderStyle: 'solid',
            borderRadius: `${config.design.borderRadius}px`,
            backgroundImage: config.design.backgroundImage ? `url(${config.design.backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Render fields */}
          {config.fields.map((field) => {
            const style = field.style || {}
            
            if (field.type === 'image') {
              return (
                <div
                  key={field.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${field.position.x}px`,
                    top: `${field.position.y}px`,
                    width: `${field.size.width}px`,
                    height: `${field.size.height}px`,
                    borderRadius: '4px'
                  }}
                >
                  <Image
                    src={field.token || '/default-avatar.png'}
                    alt={field.label || 'Photo'}
                    width={field.size.width}
                    height={field.size.height}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              )
            }

            return (
              <div
                key={field.id}
                className="absolute"
                style={{
                  left: `${field.position.x}px`,
                  top: `${field.position.y}px`,
                  width: `${field.size.width}px`,
                  height: `${field.size.height}px`,
                  fontSize: style.fontSize ? `${style.fontSize}px` : '14px',
                  fontWeight: style.fontWeight || 'normal',
                  color: style.color || '#000000',
                  textAlign: (style.align as 'left' | 'center' | 'right') || 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {field.token}
              </div>
            )
          })}

          {/* QR Code */}
          {config.qrCode?.enabled && config.qrCode.data && (
            <div
              className="absolute bg-white p-1 rounded"
              style={{
                left: `${config.qrCode.position.x}px`,
                top: `${config.qrCode.position.y}px`,
              }}
            >
              <QRCode 
                value={config.qrCode.data} 
                size={config.qrCode.size}
                level="M"
              />
            </div>
          )}
        </div>
      </CardContent>
      {idCard.name && (
        <div className="px-6 pb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Template: {idCard.name}
          </p>
        </div>
      )}
    </Card>
  )
}
