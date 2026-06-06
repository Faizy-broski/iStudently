'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
    ArrowLeft,
    Save,
    User,
    Mail,
    Briefcase,
    Phone,
    Calendar,
    Shield,
    BookOpen,
    Eye,
    EyeOff,
    Copy,
    Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect } from '@/components/ui/multi-select'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { createStaff, CreateStaffDTO } from '@/lib/api/staff'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StaffPhotoUpload } from '@/components/ui/staff-photo-upload'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useStaffDesignations } from '@/hooks/useStaffDesignations'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import { getFieldDefinitions, CustomFieldDefinition } from '@/lib/api/custom-fields'
import { getFieldOrders, DefaultFieldOrder } from '@/lib/utils/field-ordering'

// Standard categories — custom fields in these are appended to their matching cards
const STAFF_STANDARD_CATEGORIES = ['personal', 'employment', 'system']

function generatePassword(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString()
}

export default function AddStaffPage() {
    const router = useRouter()
    const t = useTranslations('staff')
    const campusContext = useCampus()
    const selectedCampus = campusContext?.selectedCampus
    const { profile } = useAuth()
    const { currencySymbol } = useSchoolSettings()

    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [copied, setCopied] = useState(false)
    const [uniqueUserNum] = useState(() => Math.floor(1000 + Math.random() * 9000))

    // Custom fields state
    const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
    const [loadingFields, setLoadingFields] = useState(true)
    const [defaultFieldOrders, setDefaultFieldOrders] = useState<DefaultFieldOrder[]>([])

    const [formData, setFormData] = useState<CreateStaffDTO>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        title: '',
        department: '',
        employment_type: 'full_time',
        date_of_joining: new Date().toISOString().split('T')[0],
        qualifications: '',
        specialization: '',
        password: '',
        profile_photo_url: '',
        base_salary: undefined,
    })

    const { designations, isLoading: designationsLoading } = useStaffDesignations(selectedCampus?.id)

    const hasLibrarian = designations.some(d => d.name.toLowerCase() === 'librarian')
    const DESIGNATIONS = designations.length > 0
        ? [...designations.map(d => d.name), ...(hasLibrarian ? [] : ['Librarian'])]
        : ['Librarian', 'Accountant', 'Clerk', 'Driver', 'Security Guard', 'Nurse', 'Receptionist']

    const isLibrarian = formData.title?.toLowerCase() === 'librarian'

    // Load custom fields when campus changes
    useEffect(() => {
        const loadCustomFields = async () => {
            setLoadingFields(true)
            try {
                const campusId = selectedCampus?.id
                const [fieldsResponse, ordersResponse] = await Promise.all([
                    getFieldDefinitions('staff', campusId),
                    getFieldOrders('staff')
                ])

                if (ordersResponse.success && ordersResponse.data) {
                    setDefaultFieldOrders(ordersResponse.data)
                }

                if (fieldsResponse.success && fieldsResponse.data) {
                    // Sort by category_order then sort_order
                    const sorted = [...fieldsResponse.data].sort((a, b) => {
                        const catDiff = (a.category_order ?? 999) - (b.category_order ?? 999)
                        return catDiff !== 0 ? catDiff : (a.sort_order ?? 1000) - (b.sort_order ?? 1000)
                    })
                    setCustomFields(sorted)
                }
            } catch (err) {
                console.error('Error loading staff custom fields', err)
            } finally {
                setLoadingFields(false)
            }
        }
        loadCustomFields()
    }, [selectedCampus?.id])

    // Auto-generate username from names and unique number
    useEffect(() => {
        if (formData.first_name && formData.last_name) {
            const cleanFirst = formData.first_name.toLowerCase().replace(/[^a-z0-9]/g, '')
            const cleanLast = formData.last_name.toLowerCase().replace(/[^a-z0-9]/g, '')
            setFormData(prev => ({ ...prev, username: `${cleanFirst}${cleanLast}${uniqueUserNum}` }))
        }
    }, [formData.first_name, formData.last_name, uniqueUserNum])

    // Auto-generate password when Librarian is selected
    useEffect(() => {
        if (isLibrarian && !formData.password) {
            setFormData(prev => ({ ...prev, password: generatePassword() }))
        }
    }, [isLibrarian])

    const handleChange = (field: keyof CreateStaffDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        if (field === 'title' && value?.toLowerCase() === 'librarian' && !formData.password) {
            setFormData(prev => ({ ...prev, [field]: value, password: generatePassword() }))
        }
    }

    const handleCustomFieldChange = (fieldKey: string, value: any) => {
        setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }))
    }

    const handleCopyPassword = () => {
        if (formData.password) {
            navigator.clipboard.writeText(formData.password)
            setCopied(true)
            toast.success(t('toasts.passwordCopied'))
            setTimeout(() => setCopied(false), 2000)
        }
    }

    // Validate required custom fields and return errors
    const validateCustomFields = (): Record<string, string> => {
        const errors: Record<string, string> = {}
        customFields.filter(f => f.required).forEach(field => {
            const value = customFieldValues[field.field_key]
            const isEmpty = value === undefined || value === null || value === '' ||
                (Array.isArray(value) && value.length === 0)
            if (isEmpty) {
                errors[`custom_${field.field_key}`] = `${field.label} is required`
            }
        })
        return errors
    }

    const handleSubmit = async () => {
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.title) {
            toast.error(t('errors.fillRequiredFields'))
            return
        }
        if (isLibrarian && !formData.password) {
            toast.error(t('errors.passwordRequiredForLibrarian'))
            return
        }

        const customErrors = validateCustomFields()
        if (Object.keys(customErrors).length > 0) {
            toast.error(`Please fill in all required fields (${Object.keys(customErrors).length} missing)`)
            return
        }

        setLoading(true)
        try {
            await createStaff({
                ...formData,
                custom_fields: customFieldValues,
                campus_id: selectedCampus?.id
            })

            toast.success(t('toasts.added'))

            if (isLibrarian) {
                toast.info(t('toasts.loginCredentials', { email: formData.email, password: formData.password }), {
                    duration: 10000
                })
            }

            router.push('/admin/staff')
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || t('errors.addStaff'))
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault()
        }
    }

    // Render a single custom field input
    const renderCustomField = (field: CustomFieldDefinition) => {
        const value = customFieldValues[field.field_key]
        const defaultValue = field.type === 'multi-select' ? [] : ''
        const currentValue = value ?? defaultValue
        const widthClass = field.type === 'long-text' ? 'col-span-1 md:col-span-2' : 'col-span-1'

        return (
            <div key={field.id} className={`${widthClass} space-y-2`}>
                <Label htmlFor={`custom-${field.field_key}`}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>

                {field.type === 'text' || field.type === 'number' || field.type === 'email' || field.type === 'tel' ? (
                    <Input
                        id={`custom-${field.field_key}`}
                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                        value={currentValue}
                        onChange={e => handleCustomFieldChange(field.field_key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                ) : field.type === 'long-text' ? (
                    <Textarea
                        id={`custom-${field.field_key}`}
                        value={currentValue}
                        onChange={e => handleCustomFieldChange(field.field_key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        rows={3}
                    />
                ) : field.type === 'date' ? (
                    <Input
                        id={`custom-${field.field_key}`}
                        type="date"
                        value={currentValue}
                        onChange={e => handleCustomFieldChange(field.field_key, e.target.value)}
                    />
                ) : field.type === 'select' ? (
                    <Select value={currentValue} onValueChange={val => handleCustomFieldChange(field.field_key, val)}>
                        <SelectTrigger>
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                            {(field.options || []).map(opt => (
                                <SelectItem key={opt} value={opt}>
                                    {opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : field.type === 'checkbox' ? (
                    <div className="flex items-center space-x-2 pt-2 rtl:space-x-reverse">
                        <Checkbox
                            id={`custom-${field.field_key}`}
                            checked={!!currentValue}
                            onCheckedChange={checked => handleCustomFieldChange(field.field_key, checked)}
                        />
                        <label htmlFor={`custom-${field.field_key}`} className="text-sm cursor-pointer">
                            {field.label}
                        </label>
                    </div>
                ) : field.type === 'multi-select' ? (
                    <MultiSelect
                        options={field.options || []}
                        value={Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : [])}
                        onChange={val => handleCustomFieldChange(field.field_key, val)}
                        placeholder={`Select ${field.label.toLowerCase()}`}
                    />
                ) : field.type === 'file' ? (
                    <div className="space-y-1">
                        <Input
                            id={`custom-${field.field_key}`}
                            type="file"
                            onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) handleCustomFieldChange(field.field_key, file.name)
                            }}
                        />
                        {currentValue && <p className="text-xs text-muted-foreground">Current: {currentValue}</p>}
                    </div>
                ) : null}
            </div>
        )
    }

    // Get custom fields for a given category, sorted by sort_order
    const getCustomFieldsForCategory = (categoryId: string) =>
        customFields
            .filter(f => f.category_id === categoryId)
            .sort((a, b) => (a.sort_order ?? 1000) - (b.sort_order ?? 1000))

    // Categories that have custom fields but no matching hardcoded card
    const extraCategoryIds = [...new Set(
        customFields
            .map(f => f.category_id)
            .filter(id => !STAFF_STANDARD_CATEGORIES.includes(id))
    )]

    const personalCustomFields = getCustomFieldsForCategory('personal')
    const employmentCustomFields = getCustomFieldsForCategory('employment')
    const systemCustomFields = getCustomFieldsForCategory('system')

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t('addStaff')}</h1>
                    <p className="text-gray-500">{t('onboard')}</p>
                </div>
            </div>

            <form onSubmit={e => e.preventDefault()} onKeyDown={handleKeyDown} className="space-y-6">
                {/* Personal Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-[#57A3CC]" />
                            {t('personal')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Photo Upload */}
                        <div className="flex flex-col items-center justify-center md:border-r md:pr-6">
                            <Label className="mb-3">{t('profilePhoto')}</Label>
                            <StaffPhotoUpload
                                value={formData.profile_photo_url || ''}
                                onChange={url => handleChange('profile_photo_url', url)}
                                schoolId={profile?.school_id || ''}
                                staffName={`${formData.first_name} ${formData.last_name}`}
                            />
                        </div>

                        {/* Standard personal fields */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>{t('firstName')} <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.first_name}
                                    onChange={e => handleChange('first_name', e.target.value)}
                                    placeholder={t('placeholders.firstName')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('lastName')} <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.last_name}
                                    onChange={e => handleChange('last_name', e.target.value)}
                                    placeholder={t('placeholders.lastName')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('emailRequired')} <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rtl:right-3 rtl:left-auto" />
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => handleChange('email', e.target.value)}
                                        className="pl-10 rtl:pr-10 rtl:pl-3"
                                        placeholder={t('placeholders.email')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('phone')}</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rtl:right-3 rtl:left-auto" />
                                    <Input
                                        type="tel"
                                        value={formData.phone}
                                        onKeyDown={e => {
                                            const nav = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
                                            if (e.ctrlKey || e.metaKey || nav.includes(e.key)) return
                                            if (!/[0-9+\-() ]/.test(e.key)) e.preventDefault()
                                        }}
                                        onChange={e => handleChange('phone', e.target.value.replace(/[^0-9+\-() ]/g, ''))}
                                        className="pl-10 rtl:pr-10 rtl:pl-3"
                                        placeholder={t('placeholders.phone')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    Username
                                    <span className="text-xs text-muted-foreground font-normal ml-1">(auto-generated)</span>
                                </Label>
                                <Input
                                    value={formData.username || ''}
                                    onChange={e => handleChange('username', e.target.value)}
                                    placeholder="firstnamelastname1234"
                                />
                                <p className="text-xs text-muted-foreground">Staff use this to log in alongside their email.</p>
                            </div>

                            {/* Custom personal fields */}
                            {!loadingFields && personalCustomFields.map(renderCustomField)}
                        </div>
                    </CardContent>
                </Card>

                {/* Employment Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-[#57A3CC]" />
                            {t('professional')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>{t('form.designationJobTitle')} <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.title}
                                    onValueChange={val => handleChange('title', val)}
                                    disabled={designationsLoading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={designationsLoading ? t('designations.loadingDesignations') : t('designations.selectDesignation')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Librarian">
                                            <div className="flex items-center gap-2">
                                                {t('designations.librarian')}
                                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                                                    {t('designations.hasLogin')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                        {designations
                                            .filter(d => d.name.toLowerCase() !== 'librarian')
                                            .map(d => (
                                                <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                            ))
                                        }
                                        {designations.length === 0 && DESIGNATIONS
                                            .filter(role => role.toLowerCase() !== 'librarian')
                                            .map(role => (
                                                <SelectItem key={role} value={role}>{role}</SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                                {isLibrarian && (
                                    <p className="text-xs text-purple-600">{t('designations.librarianGetsLoginHint')}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>{t('department')}</Label>
                                <Input
                                    value={formData.department}
                                    onChange={e => handleChange('department', e.target.value)}
                                    placeholder={t('placeholders.departmentLong')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>{t('employmentType')}</Label>
                                <Select
                                    value={formData.employment_type}
                                    onValueChange={(val: any) => handleChange('employment_type', val)}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full_time">{t('employmentTypeOptions.fullTime')}</SelectItem>
                                        <SelectItem value="part_time">{t('employmentTypeOptions.partTime')}</SelectItem>
                                        <SelectItem value="contract">{t('employmentTypeOptions.contract')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('dateOfJoining')}</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 rtl:right-3 rtl:left-auto" />
                                    <Input
                                        type="date"
                                        value={formData.date_of_joining}
                                        onChange={e => handleChange('date_of_joining', e.target.value)}
                                        className="pl-10 rtl:pr-10 rtl:pl-3"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('baseSalary')} <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium rtl:right-3 rtl:left-auto">{currencySymbol}</span>
                                    <Input
                                        type="number"
                                        value={formData.base_salary || ''}
                                        onChange={e => handleChange('base_salary', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder={t('placeholders.baseSalary')}
                                        className="pl-10 rtl:pr-10 rtl:pl-3"
                                        min="0"
                                        step="100"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">{t('requiredForPayroll')}</p>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('qualifications')}</Label>
                                <Input
                                    value={formData.qualifications}
                                    onChange={e => handleChange('qualifications', e.target.value)}
                                    placeholder={t('placeholders.qualifications')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>{t('specializationSkills')}</Label>
                                <Input
                                    value={formData.specialization}
                                    onChange={e => handleChange('specialization', e.target.value)}
                                    placeholder={t('placeholders.specializationSkills')}
                                />
                            </div>

                            {/* Custom employment fields */}
                            {!loadingFields && employmentCustomFields.map(renderCustomField)}
                        </div>

                        {isLibrarian && (
                            <Alert className="bg-purple-50 border-purple-200">
                                <BookOpen className="h-4 w-4 text-purple-600" />
                                <AlertTitle className="text-purple-800">{t('designations.systemRole')}</AlertTitle>
                                <AlertDescription className="text-purple-700">
                                    {t('designations.systemRoleDescPrefix')} <strong>{t('designations.systemLibrarian')}</strong> {t('designations.systemRoleDescSuffix')}
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Librarian Credentials */}
                {isLibrarian && (
                    <Card className="border-purple-200 bg-purple-50/50">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-purple-800">
                                <Shield className="h-5 w-5 text-purple-600" />
                                {t('designations.librarianLoginCredentials')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>{t('designations.emailUsername')}</Label>
                                    <Input value={formData.email} disabled className="bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('designations.autoGeneratedPassword')}</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={e => handleChange('password', e.target.value)}
                                                className="pr-20 bg-white"
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyPassword}>
                                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-purple-700">{t('designations.saveCredentialsHint')}</p>
                                </div>
                            </div>

                            {/* Custom system fields */}
                            {!loadingFields && systemCustomFields.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                    {systemCustomFields.map(renderCustomField)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* System custom fields when not a Librarian */}
                {!isLibrarian && !loadingFields && systemCustomFields.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Shield className="h-5 w-5 text-[#57A3CC]" />
                                System
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {systemCustomFields.map(renderCustomField)}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Extra custom field categories (not personal/employment/system) */}
                {!loadingFields && extraCategoryIds.map(categoryId => {
                    const fields = getCustomFieldsForCategory(categoryId)
                    if (fields.length === 0) return null
                    const categoryName = fields[0].category_name || categoryId
                    return (
                        <Card key={categoryId}>
                            <CardHeader>
                                <CardTitle className="text-lg capitalize">{categoryName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {fields.map(renderCustomField)}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={loading}
                        onClick={() => { if (!loading) handleSubmit() }}
                        className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white min-w-[120px]"
                    >
                        {loading ? t('creating') : t('createStaff')}
                    </Button>
                </div>
            </form>
        </div>
    )
}
