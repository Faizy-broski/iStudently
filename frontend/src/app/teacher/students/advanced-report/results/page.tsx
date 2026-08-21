'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileDown, Search, ArrowLeft, ChevronUp, ChevronDown, ArrowUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getFieldDefinitions, CustomFieldDefinition } from '@/lib/api/custom-fields'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function TeacherReportResultsPage() {
  const t = useTranslations('teacherPages.studentsAdvancedReportResults')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()

  const STANDARD_FIELDS_LABELS: Record<string, string> = {
    student_number: t('studentNumber'),
    first_name: t('firstName'),
    last_name: t('lastName'),
    father_name: t('fatherName'),
    grandfather_name: t('grandfatherName'),
    email: t('email'),
    phone: t('phone'),
    grade_level_name: t('gradeLevel'),
    section_name: t('section'),
    created_at: t('enrollmentDate'),
    is_active: t('status'),
  }

  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [filteredStudents, setFilteredStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (fieldsParam) {
      try {
        setSelectedFields(JSON.parse(decodeURIComponent(fieldsParam)))
      } catch {
        toast.error(t('invalidFieldsParameter'))
        router.push('/teacher/students/advanced-report')
      }
    } else {
      router.push('/teacher/students/advanced-report')
    }
  }, [searchParams, router])

  useEffect(() => {
    getFieldDefinitions('student')
      .then((res) => { if (res.success && res.data) setCustomFields(res.data) })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedFields.length === 0 || !profile?.school_id) return
    const fetch_ = async () => {
      setLoading(true)
      try {
        const token = await getAuthToken()
        const res = await fetch(`${API_URL}/students/report?page=1&limit=1000`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setStudents(data.data || [])
          setFilteredStudents(data.data || [])
        } else {
          toast.error(data.error || t('failedToLoadReport'))
        }
      } catch {
        toast.error(t('failedToLoadReport'))
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [selectedFields, profile?.school_id])

  useEffect(() => {
    let arr = students
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      arr = arr.filter((s) => Object.values(s).some((v) => String(v).toLowerCase().includes(q)))
    }
    if (sortField) {
      arr = [...arr].sort((a, b) => {
        const aV = String(a[sortField] ?? '')
        const bV = String(b[sortField] ?? '')
        return sortDirection === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV)
      })
    }
    setFilteredStudents(arr)
  }, [searchQuery, students, sortField, sortDirection])

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
    if (fieldId === 'is_active') return student[fieldId] ? t('active') : t('inactive')
    if (fieldId === 'created_at') return student[fieldId] ? new Date(student[fieldId]).toLocaleDateString() : '-'
    return student[fieldId] != null ? String(student[fieldId]) : '-'
  }

  const exportToCSV = () => {
    const headers = selectedFields.map(getFieldLabel)
    const rows = filteredStudents.map((s) => selectedFields.map((f) => getFieldValue(s, f)))
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `students_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success(t('exported'))
  }

  const toggleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(fieldId); setSortDirection('asc') }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#022172] mx-auto" />
          <p className="mt-4 text-muted-foreground">{t('loadingReport')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/teacher/students/advanced-report">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">{t('reportResults')}</h1>
          </div>
          <p className="text-muted-foreground mt-1">{t('studentsFound', { count: filteredStudents.length })}</p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={filteredStudents.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />{t('exportCsv')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('studentData')}</CardTitle>
          <CardDescription>{t('fieldsSelected', { count: selectedFields.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('searchStudents')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedFields.map((fieldId) => (
                    <TableHead key={fieldId} className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => toggleSort(fieldId)}>
                      <div className="flex items-center">
                        {getFieldLabel(fieldId)}
                        {sortField === fieldId
                          ? sortDirection === 'asc' ? <ChevronUp className="ml-2 h-3 w-3" /> : <ChevronDown className="ml-2 h-3 w-3" />
                          : <ArrowUpDown className="ml-2 h-3 w-3 opacity-40" />}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedFields.length} className="text-center py-8 text-muted-foreground">{t('noDataFound')}</TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <TableRow key={student.id || idx}>
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
  )
}
