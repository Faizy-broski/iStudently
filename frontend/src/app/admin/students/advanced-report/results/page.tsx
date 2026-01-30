"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileDown, Search, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"
import { useCampus } from "@/context/CampusContext"
import Link from "next/link"

// Standard fields mapping
const STANDARD_FIELDS_MAP: Record<string, string> = {
  'student_number': 'Student Number',
  'first_name': 'First Name',
  'last_name': 'Last Name',
  'father_name': 'Father Name',
  'grandfather_name': 'Grandfather Name',
  'email': 'Email',
  'phone': 'Phone',
  'grade_level_name': 'Grade Level',
  'section_name': 'Section',
  'created_at': 'Enrollment Date',
  'is_active': 'Status',
}

export default function ReportResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campusContext = useCampus()
  
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [filteredStudents, setFilteredStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Load selected fields from URL
  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (fieldsParam) {
      try {
        const fields = JSON.parse(decodeURIComponent(fieldsParam))
        setSelectedFields(fields)
      } catch (err) {
        console.error("Error parsing fields", err)
        toast.error("Invalid report parameters")
        router.push('/admin/students/advanced-report')
      }
    } else {
      toast.error("No fields selected")
      router.push('/admin/students/advanced-report')
    }
  }, [searchParams, router])

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
        
        console.log('🔍 Report Fetch - Campus Context:', {
          hasCampusContext: !!campusContext,
          selectedCampus: campusContext?.selectedCampus,
          campusId: campusId,
          willSendCampusParam: !!campusId
        })
        
        const queryParams = new URLSearchParams({
          page: '1',
          limit: '1000',
        })
        
        // ONLY add campus_id if we have a valid campus selected
        if (campusId) {
          queryParams.append('campus_id', campusId)
          console.log('✅ Adding campus_id to query:', campusId)
        } else {
          console.log('⚠️ No campus_id - will query with admin school_id')
        }

        const finalUrl = `${API_URL}/students/report?${queryParams}`
        console.log('📡 Fetching:', finalUrl)

        const response = await fetch(finalUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        })

        const data = await response.json()
        console.log('📥 Response:', {
          success: data.success,
          studentCount: data.data?.length,
          sampleStudent: data.data?.[0]
        })

        if (response.ok && data.success) {
          setStudents(data.data || [])
          setFilteredStudents(data.data || [])
          toast.success(`Report generated with ${data.data?.length || 0} students`)
        } else {
          toast.error(data.error || 'Failed to fetch report data')
        }
      } catch (err: any) {
        console.error("Error fetching report:", err)
        toast.error(err.message || "Failed to generate report")
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [selectedFields, campusContext?.selectedCampus?.id])

  // Filter students by search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredStudents(students)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = students.filter((student: any) =>
      Object.values(student).some((value: any) =>
        String(value).toLowerCase().includes(query)
      )
    )
    setFilteredStudents(filtered)
  }, [searchQuery, students])

  // Get field label
  const getFieldLabel = (fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const key = fieldId.replace('custom_', '')
      const field = customFields.find(f => f.field_key === key)
      return field?.label || key
    }
    return STANDARD_FIELDS_MAP[fieldId] || fieldId
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
      return value ? 'Active' : 'Inactive'
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
    toast.success('Report exported successfully')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#022172] mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Generating report...</p>
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
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
              Report Results
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Showing {filteredStudents.length} of {students.length} students
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={filteredStudents.length === 0}>
          <FileDown className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <CardTitle>Student Data</CardTitle>
          <CardDescription>
            {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedFields.map(fieldId => (
                    <TableHead key={fieldId} className="whitespace-nowrap">
                      {getFieldLabel(fieldId)}
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
                      No students found
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
