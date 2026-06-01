'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDown, Search, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getFieldDefinitions, CustomFieldDefinition } from '@/lib/api/custom-fields'
import { getStudents, ParentStudent } from '@/lib/api/parent-dashboard'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
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

export default function ParentReportResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [students, setStudents] = useState<ParentStudent[]>([])
  const [filteredStudents, setFilteredStudents] = useState<ParentStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (fieldsParam) {
      try {
        setSelectedFields(JSON.parse(decodeURIComponent(fieldsParam)))
      } catch {
        toast.error('Invalid fields parameter')
        router.push('/parent/students/advanced-report')
      }
    } else {
      router.push('/parent/students/advanced-report')
    }
  }, [searchParams, router])

  useEffect(() => {
    getFieldDefinitions('student')
      .then((res) => { if (res.success && res.data) setCustomFields(res.data) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedFields.length === 0) return
    setLoading(true)
    getStudents()
      .then((data) => { setStudents(data || []); setFilteredStudents(data || []) })
      .catch(() => toast.error('Failed to load student data'))
      .finally(() => setLoading(false))
  }, [selectedFields])

  useEffect(() => {
    if (!searchQuery) { setFilteredStudents(students); return }
    const q = searchQuery.toLowerCase()
    setFilteredStudents(students.filter((s) => Object.values(s).some((v) => String(v).toLowerCase().includes(q))))
  }, [searchQuery, students])

  const getFieldLabel = (fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      return customFields.find((f) => f.field_key === key)?.label || key
    }
    return STANDARD_FIELDS_LABELS[fieldId] || fieldId
  }

  const getFieldValue = (student: ParentStudent, fieldId: string) => {
    // Map standard fields to ParentStudent properties
    const fieldMap: Record<string, keyof ParentStudent> = {
      student_number: 'student_number',
      first_name: 'first_name',
      last_name: 'last_name',
      grade_level_name: 'grade_level',
      section_name: 'section',
    }
    if (fieldId.startsWith('custom_')) return '-'
    const key = fieldMap[fieldId]
    if (!key) return '-'
    const v = student[key]
    return v != null ? String(v) : '-'
  }

  const exportToCSV = () => {
    const headers = selectedFields.map(getFieldLabel)
    const rows = filteredStudents.map((s) => selectedFields.map((f) => getFieldValue(s, f)))
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `children_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Exported')
  }

  if (loading) {
    return (
      <ParentDashboardLayout hideStats={true}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#022172] mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </ParentDashboardLayout>
    )
  }

  return (
    <ParentDashboardLayout hideStats={true}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/parent/students/advanced-report">
                <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <h1 className="text-2xl font-bold text-[#022172] dark:text-white">Report Results</h1>
            </div>
            <p className="text-muted-foreground mt-1">{filteredStudents.length} child{filteredStudents.length !== 1 ? 'ren' : ''} found</p>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredStudents.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Data</CardTitle>
            <CardDescription>{selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
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
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedFields.length} className="text-center py-8 text-muted-foreground">No data found</TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        {selectedFields.map((fieldId) => (
                          <TableCell key={fieldId} className="whitespace-nowrap">{getFieldValue(student, fieldId)}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ParentDashboardLayout>
  )
}
