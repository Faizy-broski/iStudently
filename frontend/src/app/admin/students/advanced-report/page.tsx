"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Filter, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"
import { useTranslations } from "next-intl"

const STANDARD_FIELD_IDS = [
  { id: 'student_number', labelKey: 'student_number' },
  { id: 'first_name', labelKey: 'first_name' },
  { id: 'last_name', labelKey: 'last_name' },
  { id: 'father_name', labelKey: 'father_name' },
  { id: 'grandfather_name', labelKey: 'grandfather_name' },
  { id: 'email', labelKey: 'email' },
  { id: 'phone', labelKey: 'phone' },
  { id: 'grade_level_name', labelKey: 'grade_level' },
  { id: 'section_name', labelKey: 'section' },
  { id: 'created_at', labelKey: 'enrollment_date' },
  { id: 'is_active', labelKey: 'status' },
]

export default function AdvancedReportPage() {
  const t = useTranslations("school.students.advanced_report")
  const tCustom = useTranslations("school.students.custom_fields")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>(['first_name', 'last_name', 'student_number'])
  const [loading, setLoading] = useState(true)

  const standardFields = useMemo(() =>
    STANDARD_FIELD_IDS.map(f => ({ id: f.id, label: t(f.labelKey as any), category: 'general' })),
    [t]
  )

  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const response = await getFieldDefinitions('student')
        if (response.success && response.data) {
          setCustomFields(response.data)
        }
      } catch (err) {
        console.error("Error loading custom fields", err)
      } finally {
        setLoading(false)
      }
    }
    loadCustomFields()
  }, [])

  const customFieldsByCategory = customFields.reduce((acc, field) => {
    if (!acc[field.category_name]) {
      acc[field.category_name] = []
    }
    acc[field.category_name].push(field)
    return acc
  }, {} as Record<string, CustomFieldDefinition[]>)

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    )
  }

  const toggleCategory = (category: string, isCustom: boolean = false) => {
    const categoryFields = isCustom
      ? customFieldsByCategory[category]?.map(f => `custom_${f.field_key}`) || []
      : standardFields.filter(f => f.category === category).map(f => f.id)

    const allSelected = categoryFields.every(id => selectedFields.includes(id))

    if (allSelected) {
      setSelectedFields(prev => prev.filter(id => !categoryFields.includes(id)))
    } else {
      setSelectedFields(prev => [...new Set([...prev, ...categoryFields])])
    }
  }

  const translateCategory = (catName: string) => {
    const key = `cat_${catName.toLowerCase()}`
    // If it's a standard category, use the translation
    if (['personal', 'academic', 'medical', 'family', 'system'].includes(catName.toLowerCase())) {
      return tCustom(key as any)
    }
    return catName.toUpperCase()
  }

  const generateReport = () => {
    if (selectedFields.length === 0) {
      toast.error(t("no_fields_error"))
      return
    }

    const fieldsParam = encodeURIComponent(JSON.stringify(selectedFields))
    router.push(`/admin/students/advanced-report/results?fields=${fieldsParam}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Field Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("select_fields")}
          </CardTitle>
          <CardDescription>{t("select_fields_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Standard Fields - General */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#022172]">{t("general_section")}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCategory('general')}
              >
                {standardFields.every(f => selectedFields.includes(f.id))
                  ? t("deselect_all")
                  : t("select_all")}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {standardFields.map(field => (
                <div key={field.id} className="flex items-center space-x-2 rtl:space-x-reverse">
                  <Checkbox
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">
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
                  {translateCategory(category)} ({t("custom_section")})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategory(category, true)}
                >
                  {fields.every(f => selectedFields.includes(`custom_${f.field_key}`))
                    ? t("deselect_all")
                    : t("select_all")}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {fields.map(field => {
                  const fieldId = `custom_${field.field_key}`
                  return (
                    <div key={fieldId} className="flex items-center space-x-2 rtl:space-x-reverse">
                      <Checkbox
                        id={fieldId}
                        checked={selectedFields.includes(fieldId)}
                        onCheckedChange={() => toggleField(fieldId)}
                      />
                      <Label htmlFor={fieldId} className="text-sm font-normal cursor-pointer">
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
              {t("generate_report")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
