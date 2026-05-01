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
    DollarSign,
    Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// Helper to generate a random password
function generatePassword(firstName: string): string {
    const cleanName = firstName.replace(/[^a-zA-Z]/g, '').slice(0, 4) || 'User';
    const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const specialChars = ['!', '@', '#', '$'];
    const special = specialChars[Math.floor(Math.random() * specialChars.length)];
    return `${capitalizedName}${randomNum}${special}`;
}

export default function AddStaffPage() {
    const router = useRouter()
    const t = useTranslations('staff')
    const campusContext = useCampus()
    const { profile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [copied, setCopied] = useState(false)
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

    // Fetch designations from database based on selected campus
    const { designations, isLoading: designationsLoading } = useStaffDesignations(campusContext?.selectedCampus?.id)
    
    // Map designations to names for the dropdown
    // Always ensure "Librarian" is available as it's a system role with dashboard access
    const designationNames = designations.map(d => d.name)
    const hasLibrarian = designationNames.some(name => name.toLowerCase() === 'librarian')
    
    // Build final list: database designations + ensure Librarian (no "Other")
    const DESIGNATIONS = designations.length > 0 
        ? [...designationNames, ...(hasLibrarian ? [] : ['Librarian'])]
        : ['Librarian', 'Accountant', 'Clerk', 'Driver', 'Security Guard', 'Nurse', 'Receptionist']

    const isLibrarian = formData.title?.toLowerCase() === 'librarian'

    // Auto-generate password when Librarian is selected
    useEffect(() => {
        if (isLibrarian && formData.first_name && !formData.password) {
            const newPassword = generatePassword(formData.first_name)
            setFormData(prev => ({ ...prev, password: newPassword }))
        }
    }, [isLibrarian, formData.first_name])

    const handleChange = (field: keyof CreateStaffDTO, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // If switching to Librarian and first name exists, generate password
        if (field === 'title' && value?.toLowerCase() === 'librarian' && formData.first_name) {
            const newPassword = generatePassword(formData.first_name)
            setFormData(prev => ({ ...prev, [field]: value, password: newPassword }))
        }
    }

    const handleCopyPassword = () => {
        if (formData.password) {
            navigator.clipboard.writeText(formData.password)
            setCopied(true)
            toast.success(t('toasts.passwordCopied'))
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleSubmit = async () => {
        setLoading(true)

        try {
            // Validate
            if (!formData.first_name || !formData.last_name || !formData.email || !formData.title) {
                toast.error(t('errors.fillRequiredFields'))
                setLoading(false)
                return
            }

            // For Librarian, password is required
            if (isLibrarian && !formData.password) {
                toast.error(t('errors.passwordRequiredForLibrarian'))
                setLoading(false)
                return
            }

            await createStaff({
                ...formData,
                campus_id: campusContext?.selectedCampus?.id // Send the selected campus ID
            })
            
            console.log('✅ Staff created with campus_id:', campusContext?.selectedCampus?.id)
            console.log('   Campus name:', campusContext?.selectedCampus?.name)
            
            toast.success(t('toasts.added'))

            // Show credentials if it's a Librarian
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

    // Handle Enter key to prevent auto-submission
    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if (e.key === 'Enter') {
            const target = e.target as HTMLElement;
            // Allow Enter in textareas
            if (target.tagName === 'TEXTAREA') {
                return;
            }
            // Always prevent default Enter behavior to stop form auto-submission
            e.preventDefault();
        }
    };

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

            <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleKeyDown} className="space-y-6">
                {/* Personal Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-[#57A3CC]" />
                            {t('personal')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Photo Upload - Left Side */}
                        <div className="flex flex-col items-center justify-center md:border-r md:pr-6">
                            <Label className="mb-3">{t('profilePhoto')}</Label>
                            <StaffPhotoUpload
                                value={formData.profile_photo_url || ''}
                                onChange={(url) => handleChange('profile_photo_url', url)}
                                schoolId={profile?.school_id || ''}
                                staffName={`${formData.first_name} ${formData.last_name}`}
                            />
                        </div>

                        {/* Form Fields - Right Side */}
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
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => handleChange('email', e.target.value)}
                                        className="pl-10"
                                        placeholder={t('placeholders.email')}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('phone')}</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        value={formData.phone}
                                        onChange={e => handleChange('phone', e.target.value)}
                                        className="pl-10"
                                        placeholder={t('placeholders.phone')}
                                    />
                                </div>
                            </div>
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
                                        {/* Always show Librarian first with special badge */}
                                        <SelectItem value="Librarian">
                                            <div className="flex items-center gap-2">
                                                {t('designations.librarian')}
                                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                                                    {t('designations.hasLogin')}
                                                </span>
                                            </div>
                                        </SelectItem>
                                        {/* Show other designations from database */}
                                        {designations
                                            .filter(d => d.name.toLowerCase() !== 'librarian')
                                            .map(d => (
                                                <SelectItem key={d.id} value={d.name}>
                                                    {d.name}
                                                </SelectItem>
                                            ))
                                        }
                                        {/* Show fallback designations if no database designations */}
                                        {designations.length === 0 && DESIGNATIONS
                                            .filter(role => role.toLowerCase() !== 'librarian')
                                            .map(role => (
                                                <SelectItem key={role} value={role}>{role}</SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>
                                {formData.title?.toLowerCase() === 'librarian' && (
                                    <p className="text-xs text-purple-600">
                                        {t('designations.librarianGetsLoginHint')}
                                    </p>
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
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
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
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="date"
                                        value={formData.date_of_joining}
                                        onChange={e => handleChange('date_of_joining', e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>{t('baseSalary')} <span className="text-red-500">*</span></Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="number"
                                        value={formData.base_salary || ''}
                                        onChange={e => handleChange('base_salary', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        placeholder={t('placeholders.baseSalary')}
                                        className="pl-10"
                                        min="0"
                                        step="100"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">{t('requiredForPayroll')}</p>
                            </div>
                        </div>

                        {/* Librarian Role Alert */}
                        {isLibrarian && (
                            <Alert className="bg-purple-50 border-purple-200">
                                <BookOpen className="h-4 w-4 text-purple-600" />
                                <AlertTitle className="text-purple-800">{t('designations.systemRole')}</AlertTitle>
                                <AlertDescription className="text-purple-700">
                                    {t('designations.systemRoleDescPrefix')} <strong>{t('designations.systemLibrarian')}</strong> {t('designations.systemRoleDescSuffix')}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        </div>
                    </CardContent>
                </Card>

                {/* Credentials - Only show for Librarian */}
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
                                    <Input
                                        value={formData.email}
                                        disabled
                                        className="bg-white"
                                    />
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
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
                                                    onClick={handleCopyPassword}
                                                >
                                                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-purple-700">
                                        {t('designations.saveCredentialsHint')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type="button"
                        disabled={loading}
                        onClick={() => { if (!loading) handleSubmit(); }}
                        className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white min-w-[120px]"
                    >
                        {loading ? t('creating') : t('createStaff')}
                    </Button>
                </div>
            </form>
        </div>
    )
}
