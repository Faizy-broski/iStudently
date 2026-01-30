"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Filter } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"

// Standard fields for students matching actual database schema
const STANDARD_FIELDS = [
  { id: 'student_number', label: 'Student Number', category: 'general' },
  { id: 'first_name', label: 'First Name', category: 'general' },
  { id: 'last_name', label: 'Last Name', category: 'general' },
  { id: 'father_name', label: 'Father Name', category: 'general' },
  { id: 'grandfather_name', label: 'Grandfather Name', category: 'general' },
  { id: 'email', label: 'Email', category: 'general' },
  { id: 'phone', label: 'Phone', category: 'general' },
  { id: 'grade_level_name', label: 'Grade Level', category: 'general' },
  { id: 'section_name', label: 'Section', category: 'general' },
  { id: 'created_at', label: 'Enrollment Date', category: 'general' },
  { id: 'is_active', label: 'Status', category: 'general' },
]

export default function AdvancedReportPage() {
  const router = useRouter()
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>(['first_name', 'last_name', 'student_number'])

  // Load custom fields on mount
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

  // Group custom fields by category
  const customFieldsByCategory = customFields.reduce((acc, field) => {
    if (!acc[field.category_name]) {
      acc[field.category_name] = []
    }
    acc[field.category_name].push(field)
    return acc
  }, {} as Record<string, CustomFieldDefinition[]>)

  // Toggle field selection
  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    )
  }

  // Select all fields in a category
  const toggleCategory = (category: string, isCustom: boolean = false) => {
    const categoryFields = isCustom
      ? customFieldsByCategory[category]?.map(f => `custom_${f.field_key}`) || []
      : STANDARD_FIELDS.filter(f => f.category === category).map(f => f.id)

    const allSelected = categoryFields.every(id => selectedFields.includes(id))

    if (allSelected) {
      setSelectedFields(prev => prev.filter(id => !categoryFields.includes(id)))
    } else {
      setSelectedFields(prev => [...new Set([...prev, ...categoryFields])])
    }
  }

  // Generate report - navigate to results page
  const generateReport = () => {
    if (selectedFields.length === 0) {
      toast.error("Please select at least one field")
      return
    }

    // Navigate to results page with selected fields
    const fieldsParam = encodeURIComponent(JSON.stringify(selectedFields))
    router.push(`/admin/students/advanced-report/results?fields=${fieldsParam}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Advanced Report
        </h1>
        <p className="text-muted-foreground">
          Select fields to include in your custom report
        </p>
      </div>

      {/* Field Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Select Fields
          </CardTitle>
          <CardDescription>
            Choose which fields to include in the report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Standard Fields - General */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#022172]">GENERAL</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCategory('general')}
              >
                {STANDARD_FIELDS.filter(f => f.category === 'general').every(f => selectedFields.includes(f.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {STANDARD_FIELDS.filter(f => f.category === 'general').map(field => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label
                    htmlFor={field.id}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Fields by Category */}
          {Object.entries(customFieldsByCategory).map(([category, fields]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#022172]">
                  {category.toUpperCase()} (CUSTOM)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategory(category, true)}
                >
                  {fields.every(f => selectedFields.includes(`custom_${f.field_key}`))
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {fields.map(field => {
                  const fieldId = `custom_${field.field_key}`
                  return (
                    <div key={fieldId} className="flex items-center space-x-2">
                      <Checkbox
                        id={fieldId}
                        checked={selectedFields.includes(fieldId)}
                        onCheckedChange={() => toggleField(fieldId)}
                      />
                      <Label
                        htmlFor={fieldId}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {field.label}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Generate Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={generateReport}
              disabled={selectedFields.length === 0}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172]"
            >
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
