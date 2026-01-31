'use client'

import { useRef, useState } from 'react'
import { useReportCard } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table'
import {
  GraduationCap,
  Download,
  Printer,
  RefreshCw,
  AlertCircle,
  FileText,
  Award,
  TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'

export function ReportCard() {
  const { reportCard, isLoading, error, refresh } = useReportCard()
  const [isDownloading, setIsDownloading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const handleDownloadPDF = async () => {
    if (!reportCard) return
    
    setIsDownloading(true)
    try {
      // Create a simple PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const student = reportCard.student
      const margin = 15
      let y = margin

      // Header
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.text('STUDENT REPORT CARD', pdf.internal.pageSize.width / 2, y, { align: 'center' })
      y += 10

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'normal')
      pdf.text(student.school_name, pdf.internal.pageSize.width / 2, y, { align: 'center' })
      y += 15

      // Student Info
      pdf.setFontSize(11)
      pdf.text(`Student Name: ${student.name}`, margin, y)
      pdf.text(`Roll No: ${student.student_number}`, 120, y)
      y += 7
      pdf.text(`Grade: ${student.grade_level}`, margin, y)
      pdf.text(`Section: ${student.section}`, 120, y)
      y += 15

      // Table Header
      pdf.setFont('helvetica', 'bold')
      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, y - 5, 180, 8, 'F')
      pdf.text('Subject', margin + 2, y)
      pdf.text('Marks Obtained', 80, y)
      pdf.text('Total Marks', 120, y)
      pdf.text('Percentage', 150, y)
      pdf.text('Grade', 175, y)
      y += 8

      // Table Body
      pdf.setFont('helvetica', 'normal')
      for (const subject of reportCard.subjects) {
        pdf.text(subject.subject, margin + 2, y)
        pdf.text(String(subject.total_obtained), 80, y)
        pdf.text(String(subject.total_possible), 120, y)
        pdf.text(`${subject.percentage}%`, 150, y)
        pdf.text(subject.grade, 175, y)
        y += 7
      }

      // Overall Summary
      y += 5
      pdf.setFont('helvetica', 'bold')
      pdf.setFillColor(220, 220, 220)
      pdf.rect(margin, y - 5, 180, 8, 'F')
      pdf.text('OVERALL', margin + 2, y)
      pdf.text(String(reportCard.overall.total_obtained), 80, y)
      pdf.text(String(reportCard.overall.total_possible), 120, y)
      pdf.text(`${reportCard.overall.percentage}%`, 150, y)
      pdf.text(reportCard.overall.grade, 175, y)
      y += 15

      // Generated date
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'italic')
      pdf.text(
        `Generated on: ${format(new Date(reportCard.generated_at), 'PPpp')}`,
        pdf.internal.pageSize.width / 2,
        pdf.internal.pageSize.height - 10,
        { align: 'center' }
      )

      pdf.save(`report-card-${student.student_number}.pdf`)
    } catch (err) {
      // Download failed - silent
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getGradeColor = (grade: string) => {
    if (grade === 'A+' || grade === 'A') return 'bg-green-100 text-green-800'
    if (grade === 'B+' || grade === 'B') return 'bg-blue-100 text-blue-800'
    if (grade === 'C+' || grade === 'C') return 'bg-yellow-100 text-yellow-800'
    if (grade === 'D') return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Card
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[300px] rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 mb-4">Failed to load report card</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!reportCard || reportCard.subjects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GraduationCap className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">No grades available yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Report card will be available after exam results are published
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader className="print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Card
            </CardTitle>
            <CardDescription>
              Academic performance summary
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent ref={reportRef}>
        {/* Student Info Header */}
        <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg print:bg-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{reportCard.student.name}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span>Roll No: {reportCard.student.student_number}</span>
                <span>•</span>
                <span>{reportCard.student.grade_level}</span>
                <span>•</span>
                <span>Section {reportCard.student.section}</span>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`text-lg px-3 py-1 ${getGradeColor(reportCard.overall.grade)}`}>
                {reportCard.overall.grade}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {reportCard.overall.percentage}% Overall
              </p>
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Subject</TableHead>
                <TableHead className="text-center">Marks Obtained</TableHead>
                <TableHead className="text-center">Total Marks</TableHead>
                <TableHead className="text-center">Percentage</TableHead>
                <TableHead className="text-center">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportCard.subjects.map((subject) => (
                <TableRow key={subject.subject}>
                  <TableCell className="font-medium">{subject.subject}</TableCell>
                  <TableCell className="text-center">{subject.total_obtained}</TableCell>
                  <TableCell className="text-center">{subject.total_possible}</TableCell>
                  <TableCell className="text-center">
                    <span className={subject.percentage >= 60 ? 'text-green-600' : 'text-red-600'}>
                      {subject.percentage}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={getGradeColor(subject.grade)}>
                      {subject.grade}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-primary/5 font-bold">
                <TableCell>Overall Total</TableCell>
                <TableCell className="text-center">{reportCard.overall.total_obtained}</TableCell>
                <TableCell className="text-center">{reportCard.overall.total_possible}</TableCell>
                <TableCell className="text-center">
                  <span className={reportCard.overall.percentage >= 60 ? 'text-green-600' : 'text-red-600'}>
                    {reportCard.overall.percentage}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={`${getGradeColor(reportCard.overall.grade)} text-base`}>
                    {reportCard.overall.grade}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Performance Summary */}
        <div className="mt-6 grid grid-cols-3 gap-4 print:hidden">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4 flex items-center gap-3">
              <Award className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">
                  {reportCard.subjects.filter(s => s.percentage >= 75).length}
                </p>
                <p className="text-xs text-green-600">Subjects Above 75%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700">
                  {reportCard.subjects.reduce((sum, s) => sum + s.total_obtained, 0)}
                </p>
                <p className="text-xs text-blue-600">Total Marks Scored</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4 flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-700">
                  {reportCard.subjects.length}
                </p>
                <p className="text-xs text-purple-600">Subjects Evaluated</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground print:mt-12">
          <p>Generated on {format(new Date(reportCard.generated_at), 'PPpp')}</p>
          <p className="mt-1">{reportCard.student.school_name}</p>
        </div>
      </CardContent>
    </Card>
  )
}
