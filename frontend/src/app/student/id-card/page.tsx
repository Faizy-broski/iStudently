'use client'

import { useState, useEffect } from 'react'
import { generateStudentIdCard, GeneratedIdCard } from '@/lib/api/id-card-template'
import { CreditCard, Download, Printer } from 'lucide-react'
import Image from 'next/image'
import QRCode from 'react-qr-code'

export default function IdCardPage() {
  const [idCard, setIdCard] = useState<GeneratedIdCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIdCard()
  }, [])

  const fetchIdCard = async () => {
    try {
      setIsLoading(true)
      const response = await generateStudentIdCard()
      setIdCard(response.idCard)
    } catch (err: any) {
      setError(err.message || 'Failed to load ID card')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading ID card: {error}</p>
        </div>
      </div>
    )
  }

  if (!idCard) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700">ID card information not available. Please contact your administrator.</p>
        </div>
      </div>
    )
  }

  const config = idCard.template_config

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Digital ID Card</h1>
        <p className="text-gray-600 mt-1">Your official student identification</p>
      </div>

      {/* ID Card Display */}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center">
          <div 
            className="relative shadow-2xl"
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
              
              if (field.type === 'image' && field.token) {
                return (
                  <div
                    key={field.id}
                    className="absolute"
                    style={{
                      left: `${field.position.x}px`,
                      top: `${field.position.y}px`,
                      width: `${field.size.width}px`,
                      height: `${field.size.height}px`,
                    }}
                  >
                    <Image
                      src={field.token || '/default-avatar.png'}
                      alt={field.label}
                      width={field.size.width}
                      height={field.size.height}
                      className="w-full h-full object-cover rounded"
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
                    textAlign: (style.align as any) || 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {field.token}
                </div>
              )
            })}

            {/* QR Code */}
            {config.qrCode?.enabled && config.qrCode.data && (
              <div
                className="absolute"
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
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8 justify-center">
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            <Download className="w-5 h-5" />
            Download ID Card
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <Printer className="w-5 h-5" />
            Print ID Card
          </button>
        </div>

        {/* Template Info */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">Template: {idCard.name}</h3>
          {idCard.description && (
            <p className="text-blue-700 text-sm">{idCard.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
