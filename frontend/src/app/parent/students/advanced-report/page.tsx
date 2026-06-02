'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Filter } from 'lucide-react'
import { toast } from 'sonner'
import { getFieldDefinitions, CustomFieldDefinition } from '@/lib/api/custom-fields'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'

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

export default function ParentAdvancedReportPage() {
  const router = useRouter()
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>(['first_name', 'last_name', 'student_number'])

  useEffect(() => {
    getFieldDefinitions('student')
      .then((res) => { if (res.success && res.data) setCustomFields(res.data) })
      .catch(console.error)
  }, [])

  const customFieldsByCategory = customFields.reduce((acc, field) => {
    if (!acc[field.category_name]) acc[field.category_name] = []
    acc[field.category_name].push(field)
    return acc
  }, {} as Record<string, CustomFieldDefinition[]>)

  const toggleField = (id: string) =>
    setSelectedFields((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])

  const toggleCategory = (category: string, isCustom = false) => {
    const ids = isCustom
      ? customFieldsByCategory[category]?.map((f) => `custom_${f.field_key}`) || []
      : STANDARD_FIELDS.filter((f) => f.category === category).map((f) => f.id)
    const allSelected = ids.every((id) => selectedFields.includes(id))
    setSelectedFields((prev) => allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  const generateReport = () => {
    if (selectedFields.length === 0) { toast.error('Please select at least one field'); return }
    router.push(`/parent/students/advanced-report/results?fields=${encodeURIComponent(JSON.stringify(selectedFields))}`)
  }

  return (
    <ParentDashboardLayout hideStats={true}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">Advanced Report</h1>
          <p className="text-muted-foreground">Select fields to include in your children's report</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Select Fields</CardTitle>
            <CardDescription>Choose which fields to include in the report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#022172]">GENERAL</h3>
                <Button variant="ghost" size="sm" onClick={() => toggleCategory('general')}>
                  {STANDARD_FIELDS.every((f) => selectedFields.includes(f.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {STANDARD_FIELDS.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox id={field.id} checked={selectedFields.includes(field.id)} onCheckedChange={() => toggleField(field.id)} />
                    <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {Object.entries(customFieldsByCategory).map(([category, fields]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#022172]">{category.toUpperCase()} (CUSTOM)</h3>
                  <Button variant="ghost" size="sm" onClick={() => toggleCategory(category, true)}>
                    {fields.every((f) => selectedFields.includes(`custom_${f.field_key}`)) ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {fields.map((field) => {
                    const id = `custom_${field.field_key}`
                    return (
                      <div key={id} className="flex items-center space-x-2">
                        <Checkbox id={id} checked={selectedFields.includes(id)} onCheckedChange={() => toggleField(id)} />
                        <Label htmlFor={id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <Button onClick={generateReport} disabled={selectedFields.length === 0} className="bg-gradient-to-r from-[#57A3CC] to-[#022172]">
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ParentDashboardLayout>
  )
}
