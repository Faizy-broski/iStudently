'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle, Clock, DollarSign, Percent, Ban, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
    adjustFee,
    getFeeAdjustments,
    FeeAdjustmentType,
    FeeAdjustment,
    StudentFee
} from '@/lib/api/fees'

interface FeeAdjustmentModalProps {
    isOpen: boolean
    onClose: () => void
    fee: StudentFee
    onAdjusted: () => void
}

export default function FeeAdjustmentModal({ isOpen, onClose, fee, onAdjusted }: FeeAdjustmentModalProps) {
    const [adjustmentType, setAdjustmentType] = useState<FeeAdjustmentType>('custom_discount')
    const [newLateFee, setNewLateFee] = useState<number>(0)
    const [customDiscount, setCustomDiscount] = useState<number>(0)
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [adjustmentHistory, setAdjustmentHistory] = useState<FeeAdjustment[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    useEffect(() => {
        if (isOpen && fee) {
            loadAdjustmentHistory()
            // Reset form
            setAdjustmentType('custom_discount')
            setNewLateFee(fee.late_fee_applied || 0)
            setCustomDiscount(0)
            setReason('')
        }
    }, [isOpen, fee])

    const loadAdjustmentHistory = async () => {
        setLoadingHistory(true)
        try {
            const history = await getFeeAdjustments(fee.id)
            setAdjustmentHistory(history)
        } catch (error: any) {
            console.error('Failed to load adjustment history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!reason.trim()) {
            toast.error('Please provide a reason for this adjustment')
            return
        }

        setIsSubmitting(true)
        try {
            await adjustFee(fee.id, {
                type: adjustmentType,
                newLateFee: adjustmentType === 'late_fee_reduced' ? newLateFee : undefined,
                customDiscount: adjustmentType === 'custom_discount' ? customDiscount : undefined,
                reason: reason.trim()
            })

            toast.success('Fee adjusted successfully')
            onAdjusted()
            onClose()
        } catch (error: any) {
            toast.error(error.message || 'Failed to adjust fee')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getAdjustmentTypeLabel = (type: FeeAdjustmentType): string => {
        switch (type) {
            case 'late_fee_removed': return 'Late Fee Removed'
            case 'late_fee_reduced': return 'Late Fee Reduced'
            case 'custom_discount': return 'Custom Discount Applied'
            case 'fee_waived': return 'Fee Waived'
            case 'discount_restored': return 'Discount Restored'
            default: return type
        }
    }

    if (!isOpen) return null

    const studentName = fee.students?.profiles
        ? `${fee.students.profiles.first_name} ${fee.students.profiles.last_name}`
        : 'Unknown Student'

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl">
                    <div className="text-white">
                        <h2 className="text-xl font-semibold">Adjust Fee</h2>
                        <p className="text-sm text-white/80 mt-1">{studentName}</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Fee Summary */}
                <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400">Base Amount</p>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">Rs. {fee.base_amount?.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-400">Late Fee</p>
                            <p className="font-semibold text-orange-600 dark:text-orange-400">Rs. {(fee.late_fee_applied || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-400">Custom Discount</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">-Rs. {(fee.custom_discount || 0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-400">Final Amount</p>
                            <p className="font-semibold text-indigo-600 dark:text-indigo-400">Rs. {fee.final_amount?.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Adjustment Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Adjustment Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                            Adjustment Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('custom_discount')}
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${adjustmentType === 'custom_discount'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-200'
                                    }`}
                            >
                                <Percent size={20} />
                                <div className="text-left">
                                    <p className="font-medium">Add Discount</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Apply custom discount</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAdjustmentType('late_fee_removed')}
                                disabled={!fee.late_fee_applied}
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${adjustmentType === 'late_fee_removed'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-200'
                                    } ${!fee.late_fee_applied ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Clock size={20} />
                                <div className="text-left">
                                    <p className="font-medium">Remove Late Fee</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Remove entire late fee</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAdjustmentType('late_fee_reduced')}
                                disabled={!fee.late_fee_applied}
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${adjustmentType === 'late_fee_reduced'
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-200'
                                    } ${!fee.late_fee_applied ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <DollarSign size={20} />
                                <div className="text-left">
                                    <p className="font-medium">Reduce Late Fee</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Partially reduce late fee</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setAdjustmentType('fee_waived')}
                                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${adjustmentType === 'fee_waived'
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:text-gray-200'
                                    }`}
                            >
                                <Ban size={20} />
                                <div className="text-left">
                                    <p className="font-medium">Waive Fee</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Waive entire fee</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    {adjustmentType === 'late_fee_reduced' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                New Late Fee Amount
                            </label>
                            <input
                                type="number"
                                min="0"
                                max={fee.late_fee_applied}
                                value={newLateFee}
                                onChange={(e) => setNewLateFee(Number(e.target.value))}
                                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Enter new late fee amount"
                            />
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Current late fee: Rs. {fee.late_fee_applied?.toLocaleString()}
                            </p>
                        </div>
                    )}

                    {adjustmentType === 'custom_discount' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                Discount Amount (Rs.)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max={fee.final_amount}
                                value={customDiscount}
                                onChange={(e) => setCustomDiscount(Number(e.target.value))}
                                className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                                placeholder="Enter discount amount"
                            />
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                            Reason for Adjustment <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
                            placeholder="Explain why this adjustment is being made..."
                            required
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <AlertCircle size={14} />
                            This will be recorded in the audit log
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Applying...' : 'Apply Adjustment'}
                        </button>
                    </div>
                </form>

                {/* Adjustment History */}
                {adjustmentHistory.length > 0 && (
                    <div className="p-6 border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-b-xl">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <RefreshCw size={16} />
                            Adjustment History
                        </h3>
                        <div className="space-y-2">
                            {adjustmentHistory.map((adj) => (
                                <div key={adj.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-600 text-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                                {getAdjustmentTypeLabel(adj.adjustment_type)}
                                            </p>
                                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{adj.reason}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-medium ${adj.adjustment_amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {adj.adjustment_amount < 0 ? '-' : '+'}Rs. {Math.abs(adj.adjustment_amount).toLocaleString()}
                                            </p>
                                            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                                                {new Date(adj.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    {adj.adjusted_by_profile && (
                                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                                            By: {adj.adjusted_by_profile.first_name} {adj.adjusted_by_profile.last_name}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
