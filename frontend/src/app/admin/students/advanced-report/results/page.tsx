"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileDown, Search, ArrowLeft, ChevronUp, ChevronDown, ArrowUpDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"
import { useCampus } from "@/context/CampusContext"
import Link from "next/link"
import { useTranslations } from "next-intl"

// Standard fields mapping to translation keys
const STANDARD_FIELDS_MAP: Record<string, string> = {
  'student_number': 'student_number',
  'first_name': 'first_name',
  'last_name': 'last_name',
  'father_name': 'father_name',
  'grandfather_name': 'grandfather_name',
  'email': 'email',
  'phone': 'phone',
  'grade_level_name': 'grade_level',
  'section_name': 'section',
  'created_at': 'enrollment_date',
  'is_active': 'status',
}

export default function ReportResultsPage() {
  const t = useTranslations("school.students.advanced_report_results")
  const tReport = useTranslations("school.students.advanced_report")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams()
  const campusContext = useCampus()
  
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [filteredStudents, setFilteredStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // sorting
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const renderSortIcon = (fieldId: string) => {
    if (sortField !== fieldId) {
      return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground opacity-40 hover:opacity-100 transition-opacity rtl:mr-2 rtl:ml-0" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-2 h-3 w-3 text-[#022172] rtl:mr-2 rtl:ml-0" /> 
      : <ChevronDown className="ml-2 h-3 w-3 text-[#022172] rtl:mr-2 rtl:ml-0" />
  }

  // Load selected fields from URL
  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (fieldsParam) {
      try {
        const fields = JSON.parse(decodeURIComponent(fieldsParam))
        setSelectedFields(fields)
      } catch (err) {
        console.error("Error parsing fields", err)
        toast.error(tCommon("error_occurred"))
        router.push('/admin/students/advanced-report')
      }
    } else {
      toast.error(tReport("no_fields_error"))
      router.push('/admin/students/advanced-report')
    }
  }, [searchParams, router, tCommon, tReport])

  // Load custom fields
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const response = await getFieldDefinitions('student')
        if (response.success && response.data) {
          setCustomFields(response.data)
        }
      } catch (err) {
        console.error("Error loading custom fields", err)
      }
    }
    loadCustomFields()
  }, [])

  // Fetch report data
  useEffect(() => {
    if (selectedFields.length === 0) return

    const fetchReportData = async () => {
      setLoading(true)
      try {
        const token = await getAuthToken()
        const campusId = campusContext?.selectedCampus?.id
        
        const queryParams = new URLSearchParams({
          page: '1',
          limit: '1000',
        })
        
        if (campusId) {
          queryParams.append('campus_id', campusId)
        }

        const finalUrl = `${API_URL}/students/report?${queryParams}`
        const response = await fetch(finalUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setStudents(data.data || [])
          setFilteredStudents(data.data || [])
        } else {
          toast.error(data.error || tCommon("error_occurred"))
        }
      } catch (err: any) {
        console.error("Error fetching report:", err)
        toast.error(tCommon("error_occurred"))
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [selectedFields, campusContext?.selectedCampus?.id, tCommon])

  // derive filtered + sorted students
  useEffect(() => {
    let arr = students

    // apply search filtering
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      arr = arr.filter((student: any) =>
        Object.values(student).some((value: any) =>
          String(value).toLowerCase().includes(query)
        )
      )
    }

    // apply sorting if requested
    if (sortField) {
      const cmp = (a: any, b: any) => {
        const rawA = getRawValue(a, sortField)
        const rawB = getRawValue(b, sortField)
        const aStr = rawA != null ? String(rawA) : ''
        const bStr = rawB != null ? String(rawB) : ''

        const aBlank = aStr === ''
        const bBlank = bStr === ''
        if (aBlank && !bBlank) return sortDirection === 'asc' ? -1 : 1
        if (!aBlank && bBlank) return sortDirection === 'asc' ? 1 : -1

        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
        return 0
      }
      arr = [...arr].sort(cmp)
    }

    setFilteredStudents(arr)
  }, [searchQuery, students, sortField, sortDirection])

  // Get field label
  const getFieldLabel = (fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      const field = customFields.find(f => f.field_key === key)
      return field?.label || key
    }
    const labelKey = STANDARD_FIELDS_MAP[fieldId]
    return labelKey ? tReport(labelKey as any) : fieldId
  }

  // return raw (unformatted) value used for sorting
  const getRawValue = (student: any, fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      return student.custom_fields?.[key] ?? ''
    }
    return student[fieldId] ?? ''
  }

  // Get field value
  const getFieldValue = (student: any, fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      const value = student.custom_fields?.[key]
      return value !== undefined && value !== null ? String(value) : '-'
    }

    const value = student[fieldId]
    
    // Format specific fields
    if (fieldId === 'is_active') {
      return value ? t("active") : t("inactive")
    }
    
    if (fieldId === 'created_at') {
      return value ? new Date(value).toLocaleDateString() : '-'
    }

    return value !== undefined && value !== null ? String(value) : '-'
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = selectedFields.map(getFieldLabel)
    const rows = filteredStudents.map(student =>
      selectedFields.map(fieldId => getFieldValue(student, fieldId))
    )

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success(tCommon("success"))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#022172] mx-auto" />
            <p className="mt-4 text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/students/advanced-report">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
              {t("title")}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            {t("students_found", { count: filteredStudents.length })}
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={filteredStudents.length === 0}>
          <FileDown className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t("export_csv")}
        </Button>
      </div>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("student_data")}</CardTitle>
          <CardDescription>
            {t("fields_selected", { count: selectedFields.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:right-3 rtl:left-auto" />
              <Input
                placeholder={t("search_placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rtl:pr-10 rtl:pl-3"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedFields.map(fieldId => (
                    <TableHead
                      key={fieldId}
                      className="whitespace-nowrap cursor-pointer select-none group hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        if (sortField === fieldId) {
                          setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
                        } else {
                          setSortField(fieldId)
                          setSortDirection('asc')
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <span>{getFieldLabel(fieldId)}</span>
                        {renderSortIcon(fieldId)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={selectedFields.length}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("no_data")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <TableRow key={student.id || idx}>
                      {selectedFields.map(fieldId => (
                        <TableCell key={fieldId} className="whitespace-nowrap">
                          {getFieldValue(student, fieldId)}
                        </TableCell>
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