'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, DollarSign, Edit2, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
    createStudentFeeOverride,
    getStudentFeeOverrides,
    updateStudentFeeOverride,
    deleteStudentFeeOverride,
    StudentFeeOverride,
    FeeCategory,
    getFeeCategories
} from '@/lib/api/fees'
import { createClient } from '@/lib/supabase/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Student {
    id: string
    student_number?: string
    profile?: { first_name: string; last_name: string }
    profiles?: { first_name: string; last_name: string }
    grade_level?: string
    grade_levels?: { name: string }
}

interface AcademicYear {
    id: string
    name: string
    is_current: boolean
}

interface StudentFeeOverrideModalProps {
    isOpen: boolean
    onClose: () => void
    student: Student
    schoolId: string
    onUpdated?: () => void
}

export default function StudentFeeOverrideModal({
    isOpen,
    onClose,
    student,
    schoolId,
    onUpdated
}: StudentFeeOverrideModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [overrides, setOverrides] = useState<StudentFeeOverride[]>([])
    const [loadingOverrides, setLoadingOverrides] = useState(false)
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([])
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
    const [loadingData, setLoadingData] = useState(false)

    // Form state
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
    const [overrideAmount, setOverrideAmount] = useState<string>('')
    const [reason, setReason] = useState('')

    useEffect(() => {
        if (isOpen && student && schoolId) {
            loadData()
            loadOverrides()
        }
    }, [isOpen, student, schoolId])

    const loadData = async () => {
        setLoadingData(true)
        try {
            // Load fee categories
            const categories = await getFeeCategories(schoolId)
            setFeeCategories(categories)

            // Load academic years
            const supabase = createClient()
            const token = (await supabase.auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/academic-years?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            if (json.success) {
                setAcademicYears(json.data || [])
                // Set default to current academic year
                const currentYear = json.data?.find((y: AcademicYear) => y.is_current)
                if (currentYear) {
                    setSelectedAcademicYear(currentYear.name)
                }
            }
        } catch (error) {
            console.error('Failed to load data:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const loadOverrides = async () => {
        setLoadingOverrides(true)
        try {
            const data = await getStudentFeeOverrides(student.id, schoolId)
            setOverrides(data)
        } catch (error: any) {
            console.error('Failed to load overrides:', error)
            toast.error('Failed to load fee overrides')
        } finally {
            setLoadingOverrides(false)
        }
    }

    const resetForm = () => {
        setSelectedCategoryId('')
        setOverrideAmount('')
        setReason('')
        setIsAdding(false)
        setEditingId(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!selectedCategoryId || !selectedAcademicYear || !overrideAmount) {
            toast.error('Please fill in all required fields')
            return
        }

        const amount = parseFloat(overrideAmount)
        if (isNaN(amount) || amount < 0) {
            toast.error('Please enter a valid amount')
            return
        }

        setIsSubmitting(true)
        try {
            if (editingId) {
                await updateStudentFeeOverride(editingId, {
                    school_id: schoolId,
                    override_amount: amount,
                    reason: reason.trim() || undefined
                })
                toast.success('Fee override updated successfully')
            } else {
                await createStudentFeeOverride({
                    school_id: schoolId,
                    student_id: student.id,
                    fee_category_id: selectedCategoryId,
                    academic_year: selectedAcademicYear,
                    override_amount: amount,
                    reason: reason.trim() || undefined
                })
                toast.success('Fee override created successfully')
            }
            resetForm()
            loadOverrides()
            onUpdated?.()
        } catch (error: any) {
            toast.error(error.message || 'Failed to save fee override')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEdit = (override: StudentFeeOverride) => {
        setEditingId(override.id)
        setSelectedCategoryId(override.fee_category_id)
        setSelectedAcademicYear(override.academic_year)
        setOverrideAmount(override.override_amount.toString())
        setReason(override.reason || '')
        setIsAdding(true)
    }

    const handleDelete = async (overrideId: string) => {
        if (!confirm('Are you sure you want to delete this fee override?')) return

        try {
            await deleteStudentFeeOverride(overrideId, schoolId)
            toast.success('Fee override deleted')
            loadOverrides()
            onUpdated?.()
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete fee override')
        }
    }

    const handleToggleActive = async (override: StudentFeeOverride) => {
        try {
            await updateStudentFeeOverride(override.id, {
                school_id: schoolId,
                is_active: !override.is_active
            })
            toast.success(override.is_active ? 'Override deactivated' : 'Override activated')
            loadOverrides()
            onUpdated?.()
        } catch (error: any) {
            toast.error(error.message || 'Failed to update override')
        }
    }

    if (!isOpen) return null

    // Handle both profile and profiles data formats
    const studentProfile = student.profile || student.profiles
    const studentName = studentProfile 
        ? `${studentProfile.first_name} ${studentProfile.last_name}`
        : 'Unknown Student'
    
    // Handle both grade_level (string) and grade_levels (object) formats
    const gradeName = student.grade_levels?.name || student.grade_level

    // Filter out categories that already have overrides for this academic year (unless editing)
    const availableCategories = feeCategories.filter(cat => {
        if (editingId) {
            const editingOverride = overrides.find(o => o.id === editingId)
            if (editingOverride?.fee_category_id === cat.id) return true
        }
        return !overrides.some(
            o => o.fee_category_id === cat.id &&
                o.academic_year === selectedAcademicYear &&
                o.id !== editingId
        )
    })

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-xl">
                    <div className="text-white">
                        <h2 className="text-xl font-semibold">Fee Overrides</h2>
                        <p className="text-sm text-white/80 mt-1">{studentName}</p>
                        {gradeName && (
                            <p className="text-xs text-white/60">{gradeName}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Info Banner */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5" size={18} />
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                                <p className="font-medium">Override Pre-defined Fees</p>
                                <p className="mt-1 text-blue-600 dark:text-blue-400">
                                    Set custom fee amounts for this student. Overrides will apply when generating new fees.
                                    Existing fees are not affected.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Existing Overrides */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Current Overrides
                            </h3>
                            {!isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                                >
                                    <Plus size={16} />
                                    Add Override
                                </button>
                            )}
                        </div>

                        {loadingOverrides ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                Loading overrides...
                            </div>
                        ) : overrides.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <DollarSign className="mx-auto mb-2 opacity-50" size={24} />
                                <p>No fee overrides set for this student</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {overrides.map((override) => (
                                    <div
                                        key={override.id}
                                        className={`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 ${
                                            !override.is_active ? 'opacity-60' : ''
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                                        {override.fee_categories?.name || 'Unknown Category'}
                                                    </p>
                                                    {!override.is_active && (
                                                        <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {override.academic_year}
                                                </p>
                                                {override.reason && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        {override.reason}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {override.override_amount.toLocaleString()}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(override)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(override)}
                                                        className={`p-1 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400`}
                                                        title={override.is_active ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {override.is_active ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                                            </svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                                <circle cx="12" cy="12" r="3"/>
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(override.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add/Edit Form */}
                    {isAdding && (
                        <form onSubmit={handleSubmit} className="border-t dark:border-gray-700 pt-6">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
                                {editingId ? 'Edit Override' : 'New Override'}
                            </h3>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Academic Year */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                        Academic Year <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedAcademicYear}
                                        onChange={(e) => setSelectedAcademicYear(e.target.value)}
                                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-gray-100"
                                        required
                                        disabled={!!editingId}
                                    >
                                        <option value="">Select Year</option>
                                        {academicYears.map((year) => (
                                            <option key={year.id} value={year.name}>
                                                {year.name} {year.is_current ? '(Current)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Fee Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                        Fee Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedCategoryId}
                                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-gray-100"
                                        required
                                        disabled={!!editingId}
                                    >
                                        <option value="">Select Category</option>
                                        {availableCategories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({cat.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Override Amount */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                    Custom Fee Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={overrideAmount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="Enter custom fee amount"
                                    required
                                />
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    This amount will be used instead of the grade-level fee structure amount
                                </p>
                            </div>

                            {/* Reason */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                    Reason (Optional)
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-gray-100"
                                    placeholder="e.g., Scholarship recipient, Staff discount, etc."
                                />
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || loadingData}
                                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Override' : 'Create Override'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
