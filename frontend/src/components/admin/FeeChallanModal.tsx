'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Printer, Download, Clock, CreditCard, History, FileText } from 'lucide-react'
import { getStudentFeeById, getFeeAdjustments, FeeAdjustment, StudentFee, FeePayment } from '@/lib/api/fees'

interface FeeChallanModalProps {
    isOpen: boolean
    onClose: () => void
    feeId: string
    schoolId: string
}

export default function FeeChallanModal({ isOpen, onClose, feeId, schoolId }: FeeChallanModalProps) {
    const [fee, setFee] = useState<(StudentFee & { payments: FeePayment[] }) | null>(null)
    const [adjustments, setAdjustments] = useState<FeeAdjustment[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'adjustments'>('details')
    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isOpen && feeId) {
            loadFeeDetails()
        }
    }, [isOpen, feeId])

    const loadFeeDetails = async () => {
        setLoading(true)
        try {
            const [feeData, adjustmentData] = await Promise.all([
                getStudentFeeById(feeId, schoolId),
                getFeeAdjustments(feeId)
            ])
            setFee(feeData)
            setAdjustments(adjustmentData)
        } catch (error) {
            console.error('Failed to load fee details:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        const printContent = printRef.current
        if (!printContent) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Fee Challan - ${studentName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                    .header h1 { margin: 0; color: #333; }
                    .header p { margin: 5px 0; color: #666; }
                    .student-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .info-block { flex: 1; }
                    .info-block p { margin: 5px 0; }
                    .label { color: #666; font-size: 12px; }
                    .value { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background: #f5f5f5; }
                    .amount { text-align: right; }
                    .total-row { font-weight: bold; background: #f9f9f9; }
                    .status { padding: 5px 10px; border-radius: 4px; display: inline-block; }
                    .status-pending { background: #fef3c7; color: #92400e; }
                    .status-paid { background: #d1fae5; color: #065f46; }
                    .status-overdue { background: #fee2e2; color: #991b1b; }
                    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <div class="footer">
                    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>This is a computer-generated document.</p>
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    if (!isOpen) return null

    const studentName = fee?.students?.profiles
        ? `${fee.students.profiles.first_name} ${fee.students.profiles.last_name}`
        : 'Loading...'

    const studentNumber = fee?.students?.student_number || ''
    const feeCategory = fee?.fee_structures?.fee_categories?.name || 'Unknown'

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800'
            case 'overdue': return 'bg-red-100 text-red-800'
            case 'partial': return 'bg-yellow-100 text-yellow-800'
            case 'waived': return 'bg-gray-100 text-gray-800'
            default: return 'bg-blue-100 text-blue-800'
        }
    }

    const getAdjustmentTypeLabel = (type: string) => {
        switch (type) {
            case 'late_fee_removed': return 'Late Fee Removed'
            case 'late_fee_reduced': return 'Late Fee Reduced'
            case 'custom_discount': return 'Custom Discount'
            case 'fee_waived': return 'Fee Waived'
            case 'discount_restored': return 'Discount Restored'
            default: return type
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-600 to-teal-600">
                    <div className="text-white">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <FileText size={24} />
                            Fee Challan
                        </h2>
                        <p className="text-sm text-white/80 mt-1">{studentName} • {studentNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title="Print Challan"
                        >
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-600">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'details'
                                ? 'border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <FileText size={16} className="inline mr-2" />
                        Fee Details
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'payments'
                                ? 'border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <CreditCard size={16} className="inline mr-2" />
                        Payments ({fee?.payments?.length || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('adjustments')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${activeTab === 'adjustments'
                                ? 'border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <History size={16} className="inline mr-2" />
                        Adjustments ({adjustments.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        </div>
                    ) : (
                        <>
                            {/* Fee Details Tab */}
                            {activeTab === 'details' && fee && (
                                <div ref={printRef}>
                                    {/* Printable Header */}
                                    <div className="header hidden print:block">
                                        <h1>FEE CHALLAN</h1>
                                        <p>Academic Year: {fee.academic_year}</p>
                                    </div>

                                    {/* Student Info */}
                                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
                                            <p className="font-semibold dark:text-gray-100">{studentName}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">{studentNumber}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                                            <p className="font-semibold dark:text-gray-100">{new Date(fee.due_date).toLocaleDateString()}</p>
                                            <span className={`text-xs px-2 py-1 rounded ${getStatusClass(fee.status)}`}>
                                                {fee.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Fee Breakdown Table */}
                                    <table className="w-full border-collapse mb-6">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-700">
                                                <th className="border dark:border-gray-600 p-3 text-left dark:text-gray-100">Description</th>
                                                <th className="border dark:border-gray-600 p-3 text-right w-32 dark:text-gray-100">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Fee Category Breakdown */}
                                            {fee.fee_breakdown && Array.isArray(fee.fee_breakdown) && fee.fee_breakdown.length > 0 ? (
                                                fee.fee_breakdown.map((category, index) => (
                                                    <tr key={index}>
                                                        <td className="border dark:border-gray-600 p-3 dark:text-gray-200">
                                                            {category.category_name}
                                                            {category.category_code && (
                                                                <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">({category.category_code})</span>
                                                            )}
                                                        </td>
                                                        <td className="border dark:border-gray-600 p-3 text-right dark:text-gray-200">{category.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                // Fallback for old records without breakdown
                                                <tr>
                                                    <td className="border dark:border-gray-600 p-3 dark:text-gray-200">
                                                        {feeCategory}
                                                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">(Base Fee)</span>
                                                    </td>
                                                    <td className="border dark:border-gray-600 p-3 text-right dark:text-gray-200">{fee.base_amount?.toLocaleString()}</td>
                                                </tr>
                                            )}

                                            {(fee as any).services_amount > 0 && (
                                                <tr>
                                                    <td className="border dark:border-gray-600 p-3 dark:text-gray-200">Service Charges</td>
                                                    <td className="border dark:border-gray-600 p-3 text-right dark:text-gray-200">{(fee as any).services_amount?.toLocaleString()}</td>
                                                </tr>
                                            )}

                                            {fee.sibling_discount > 0 && (
                                                <tr className="text-green-700 dark:text-green-400">
                                                    <td className="border dark:border-gray-600 p-3">Sibling Discount</td>
                                                    <td className="border dark:border-gray-600 p-3 text-right">-{fee.sibling_discount?.toLocaleString()}</td>
                                                </tr>
                                            )}

                                            {fee.custom_discount > 0 && (
                                                <tr className="text-green-700 dark:text-green-400">
                                                    <td className="border dark:border-gray-600 p-3">
                                                        Custom Discount
                                                        {(fee as any).discount_reason && (
                                                            <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">({(fee as any).discount_reason})</span>
                                                        )}
                                                    </td>
                                                    <td className="border dark:border-gray-600 p-3 text-right">-{fee.custom_discount?.toLocaleString()}</td>
                                                </tr>
                                            )}

                                            {fee.late_fee_applied > 0 && (
                                                <tr className="text-orange-700 dark:text-orange-400">
                                                    <td className="border dark:border-gray-600 p-3 flex items-center gap-2">
                                                        Late Fee
                                                        {(fee as any).late_fee_applied_at && (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                                <Clock size={12} />
                                                                {new Date((fee as any).late_fee_applied_at).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="border dark:border-gray-600 p-3 text-right">+{fee.late_fee_applied?.toLocaleString()}</td>
                                                </tr>
                                            )}

                                            <tr className="bg-gray-50 dark:bg-gray-700 font-bold">
                                                <td className="border dark:border-gray-600 p-3 dark:text-gray-100">Total Amount</td>
                                                <td className="border dark:border-gray-600 p-3 text-right dark:text-gray-100">{fee.final_amount?.toLocaleString()}</td>
                                            </tr>

                                            <tr className="text-green-700 dark:text-green-400">
                                                <td className="border dark:border-gray-600 p-3">Amount Paid</td>
                                                <td className="border dark:border-gray-600 p-3 text-right">-{fee.amount_paid?.toLocaleString()}</td>
                                            </tr>

                                            <tr className="bg-emerald-50 dark:bg-emerald-900/30 font-bold text-emerald-800 dark:text-emerald-300">
                                                <td className="border dark:border-gray-600 p-3">Balance Due</td>
                                                <td className="border dark:border-gray-600 p-3 text-right">
                                                    {(fee.final_amount - fee.amount_paid).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Notes */}
                                    {(fee as any).notes && (
                                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                                <strong>Note:</strong> {(fee as any).notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Payments Tab */}
                            {activeTab === 'payments' && (
                                <div>
                                    {fee?.payments && fee.payments.length > 0 ? (
                                        <div className="space-y-3">
                                            {fee.payments.map((payment) => (
                                                <div key={payment.id} className="p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold text-green-700 dark:text-green-400">
                                                                {payment.amount.toLocaleString()}
                                                            </p>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                {payment.payment_method || 'Cash'}
                                                                {payment.payment_reference && (
                                                                    <span className="ml-2">• Ref: {payment.payment_reference}</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                                {new Date(payment.payment_date).toLocaleDateString()}
                                                            </p>
                                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                                {new Date(payment.payment_date).toLocaleTimeString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {payment.notes && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">"{payment.notes}"</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                                            <p>No payments recorded yet</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Adjustments Tab */}
                            {activeTab === 'adjustments' && (
                                <div>
                                    {adjustments.length > 0 ? (
                                        <div className="space-y-3">
                                            {adjustments.map((adj) => (
                                                <div key={adj.id} className="p-4 border dark:border-gray-600 rounded-lg">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium dark:text-gray-100">
                                                                {getAdjustmentTypeLabel(adj.adjustment_type)}
                                                            </p>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{adj.reason}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`font-semibold ${adj.adjustment_amount < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {adj.adjustment_amount < 0 ? '-' : '+'}{Math.abs(adj.adjustment_amount).toLocaleString()}
                                                            </p>
                                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                                {new Date(adj.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t dark:border-gray-600">
                                                        <span>Before: {adj.amount_before.toLocaleString()}</span>
                                                        <span>After: {adj.amount_after.toLocaleString()}</span>
                                                    </div>
                                                    {adj.adjusted_by_profile && (
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                            By: {adj.adjusted_by_profile.first_name} {adj.adjusted_by_profile.last_name}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                            <History size={48} className="mx-auto mb-4 opacity-30" />
                                            <p>No adjustments made</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Print Challan
                    </button>
                </div>
            </div>
        </div>
    )
}
