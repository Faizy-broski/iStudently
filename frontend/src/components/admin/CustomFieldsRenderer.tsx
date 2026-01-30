'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { getFieldDefinitions, CustomFieldDefinition, EntityType } from '@/lib/api/custom-fields'
import { Loader2 } from 'lucide-react'

interface CustomFieldsRendererProps {
    entityType: EntityType
    values: Record<string, any>
    onChange: (values: Record<string, any>) => void
    disabled?: boolean
}

/**
 * Reusable component that renders custom fields for an entity type
 * Fields are displayed inline and sorted by sort_order
 */
export function CustomFieldsRenderer({
    entityType,
    values,
    onChange,
    disabled = false
}: CustomFieldsRendererProps) {
    const [fields, setFields] = useState<CustomFieldDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchFields = async () => {
            try {
                setLoading(true)
                const response = await getFieldDefinitions(entityType)
                if (response.success && response.data) {
                    // Sort by sort_order (should already be sorted by backend, but ensure)
                    const sortedFields = [...response.data].sort((a, b) => a.sort_order - b.sort_order)
                    setFields(sortedFields)
                } else {
                    console.error('Failed to fetch custom fields:', response.error)
                }
            } catch (err) {
                console.error('Error fetching custom fields:', err)
                setError('Failed to load custom fields')
            } finally {
                setLoading(false)
            }
        }

        fetchFields()
    }, [entityType])

    const handleFieldChange = (fieldKey: string, value: any) => {
        onChange({
            ...values,
            [fieldKey]: value
        })
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading custom fields...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-sm text-red-500 py-2">
                {error}
            </div>
        )
    }

    if (fields.length === 0) {
        return null // No custom fields defined
    }

    // Group fields by category for better organization
    const fieldsByCategory: Record<string, CustomFieldDefinition[]> = {}
    fields.forEach(field => {
        if (!fieldsByCategory[field.category_name]) {
            fieldsByCategory[field.category_name] = []
        }
        fieldsByCategory[field.category_name].push(field)
    })

    const renderField = (field: CustomFieldDefinition) => {
        const value = values[field.field_key] ?? ''
        const fieldId = `custom-${field.field_key}`

        switch (field.type) {
            case 'text':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldId}
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                            disabled={disabled}
                            required={field.required}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                    </div>
                )

            case 'long-text':
                return (
                    <div key={field.id} className="space-y-2 col-span-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Textarea
                            id={fieldId}
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                            disabled={disabled}
                            required={field.required}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            rows={3}
                        />
                    </div>
                )

            case 'number':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldId}
                            type="number"
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_key, e.target.value ? Number(e.target.value) : '')}
                            disabled={disabled}
                            required={field.required}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                    </div>
                )

            case 'date':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldId}
                            type="date"
                            value={value}
                            onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                            disabled={disabled}
                            required={field.required}
                        />
                    </div>
                )

            case 'checkbox':
                return (
                    <div key={field.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                            id={fieldId}
                            checked={!!value}
                            onCheckedChange={(checked) => handleFieldChange(field.field_key, checked)}
                            disabled={disabled}
                        />
                        <Label htmlFor={fieldId} className="cursor-pointer">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                    </div>
                )

            case 'select':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Select
                            value={value || ''}
                            onValueChange={(v) => handleFieldChange(field.field_key, v)}
                            disabled={disabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options?.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )

            case 'multi-select':
                // For multi-select, store as array
                const selectedValues = Array.isArray(value) ? value : []
                return (
                    <div key={field.id} className="space-y-2 col-span-2">
                        <Label>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                            {field.options?.map((option) => (
                                <label key={option} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded cursor-pointer hover:bg-muted/80">
                                    <Checkbox
                                        checked={selectedValues.includes(option)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                handleFieldChange(field.field_key, [...selectedValues, option])
                                            } else {
                                                handleFieldChange(field.field_key, selectedValues.filter((v: string) => v !== option))
                                            }
                                        }}
                                        disabled={disabled}
                                    />
                                    <span className="text-sm">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )

            case 'file':
                return (
                    <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldId}
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                    // For now, just store file name. Actual upload would need backend support
                                    handleFieldChange(field.field_key, file.name)
                                }
                            }}
                            disabled={disabled}
                            required={field.required}
                        />
                        {value && <p className="text-xs text-muted-foreground">Current: {value}</p>}
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {Object.entries(fieldsByCategory).map(([categoryName, categoryFields]) => (
                <div key={categoryName} className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">
                        {categoryName}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categoryFields.map(renderField)}
                    </div>
                </div>
            ))}
        </div>
    )
}
