'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDown, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getFieldDefinitions, CustomFieldDefinition } from '@/lib/api/custom-fields'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

const STANDARD_FIELDS_LABELS: Record<string, string> = {
  student_number: 'Student Number',
  first_name: 'First Name',
  last_name: 'Last Name',
  father_name: 'Father Name',
  grandfather_name: 'Grandfather Name',
  email: 'Email',
  phone: 'Phone',
  grade_level_name: 'Grade Level',
  section_name: 'Section',
  created_at: 'Enrollment Date',
  is_active: 'Status',
}

export default function StudentReportResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()

  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [studentData, setStudentData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (fieldsParam) {
      try {
        setSelectedFields(JSON.parse(decodeURIComponent(fieldsParam)))
      } catch {
        toast.error('Invalid fields parameter')
        router.push('/student/students/advanced-report')
      }
    } else {
      router.push('/student/students/advanced-report')
    }
  }, [searchParams, router])

  useEffect(() => {
    getFieldDefinitions('student')
      .then((res) => { if (res.success && res.data) setCustomFields(res.data) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedFields.length === 0 || !profile?.student_id) return
    const fetch_ = async () => {
      setLoading(true)
      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/students/${profile.student_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setStudentData(data.data)
        } else {
          toast.error(data.error || 'Failed to load your data')
        }
      } catch {
        toast.error('Failed to load your data')
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [selectedFields, profile?.student_id])

  const getFieldLabel = (fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      return customFields.find((f) => f.field_key === key)?.label || key
    }
    return STANDARD_FIELDS_LABELS[fieldId] || fieldId
  }

  const getFieldValue = (student: any, fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const v = student.custom_fields?.[fieldId.replace('custom_', '')]
      return v != null ? String(v) : '-'
    }
    if (fieldId === 'is_active') return student[fieldId] ? 'Active' : 'Inactive'
    if (fieldId === 'created_at') return student[fieldId] ? new Date(student[fieldId]).toLocaleDateString() : '-'
    return student[fieldId] != null ? String(student[fieldId]) : '-'
  }

  const exportToCSV = () => {
    if (!studentData) return
    const headers = selectedFields.map(getFieldLabel)
    const row = selectedFields.map((f) => getFieldValue(studentData, f))
    const csv = [headers.join(','), row.map((c) => `"${c}"`).join(',')].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `my_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Exported')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#022172] mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/student/students/advanced-report">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#022172] dark:text-white">My Report</h1>
          </div>
          <p className="text-muted-foreground mt-1">Your personal student data</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={!studentData}>
          <FileDown className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Data</CardTitle>
          <CardDescription>{selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedFields.map((fieldId) => (
                    <TableHead key={fieldId} className="whitespace-nowrap">{getFieldLabel(fieldId)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!studentData ? (
                  <TableRow>
                    <TableCell colSpan={selectedFields.length} className="text-center py-8 text-muted-foreground">No data available</TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    {selectedFields.map((fieldId) => (
                      <TableCell key={fieldId} className="whitespace-nowrap">{getFieldValue(studentData, fieldId)}</TableCell>
                    ))}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
