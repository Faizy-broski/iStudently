'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Download, Printer, User } from 'lucide-react'
import { StudentSelector } from '@/components/parent/StudentSelector'
import Image from 'next/image'
import { useRef, useState } from 'react'

export default function ParentIdCardPage() {
  const { selectedStudent, students, isLoading } = useParentDashboard()
  const cardRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const student = students.find(s => s.id === selectedStudent)

  const handleDownload = async () => {
    if (!cardRef.current) return
    
    setIsDownloading(true)
    try {
      // Dynamic import html2canvas
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      })
      
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `student-id-card-${student?.student_number || 'card'}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      // Failed to download - silent fail
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 max-w-md" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Student ID Card
          </h1>
          <p className="text-muted-foreground">
            View and download student ID card
          </p>
        </div>
        <StudentSelector />
      </div>

      {student && (
        <div className="max-w-md mx-auto space-y-4">
          {/* ID Card Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ID Card Preview</span>
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
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={cardRef}
                className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg"
              >
                {/* School Header */}
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold">{student.campus_name}</h3>
                  <p className="text-xs opacity-80">Student Identity Card</p>
                </div>

                {/* Student Photo & Info */}
                <div className="flex gap-4 items-start">
                  <div className="w-20 h-24 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                    {student.profile_photo_url ? (
                      <Image
                        src={student.profile_photo_url}
                        alt="Student Photo"
                        width={80}
                        height={96}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <User className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <p className="font-bold text-lg">
                      {student.first_name} {student.last_name}
                    </p>
                    <div className="text-sm opacity-90 space-y-0.5">
                      <p>ID: {student.student_number}</p>
                      <p>Grade: {student.grade_level}</p>
                      <p>Section: {student.section}</p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-white/30 text-center">
                  <p className="text-xs opacity-70">
                    Valid for Academic Year 2025-2026
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Note */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> This is a digital preview of the student ID card. 
                For official school-issued ID cards with custom templates, please contact the school administration.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {!student && (
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg text-muted-foreground">No student selected</p>
            <p className="text-sm text-muted-foreground">Select a student to view their ID card</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
