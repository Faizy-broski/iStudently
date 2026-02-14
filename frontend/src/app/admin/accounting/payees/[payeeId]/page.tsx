'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconUsers, IconPlus, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import Link from 'next/link'
import * as accountingApi from '@/lib/api/accounting'
import type { Payee, PayeePayment } from '@/lib/api/accounting'

export default function PayeeDetailPage() {
    const router = useRouter()
    const params = useParams()
    const payeeId = params.payeeId as string
    
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        bank: '',
        account_number: '',
        swift_iban: '',
        bsb_bic: '',
        rollover: false
    })

    // New payment form
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [paymentData, setPaymentData] = useState({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        description: '',
        reference_number: ''
    })
    const [savingPayment, setSavingPayment] = useState(false)

    // Fetch payee data
    const { data: payeeResponse, isLoading: loadingPayee, mutate: mutatePayee } = useSWR(
        campusId && payeeId ? ['payee', campusId, payeeId] : null,
        () => accountingApi.getPayeeById(campusId!, payeeId),
        { revalidateOnFocus: false }
    )

    // Fetch payee payments
    const { data: paymentsResponse, isLoading: loadingPayments, mutate: mutatePayments } = useSWR(
        campusId && payeeId ? ['payee-payments', campusId, payeeId] : null,
        () => accountingApi.getPayeePayments(campusId!, payeeId),
        { revalidateOnFocus: false }
    )

    const payee: Payee | undefined = payeeResponse?.data
    const payments: PayeePayment[] = useMemo(() => paymentsResponse?.data || [], [paymentsResponse?.data])

    // Initialize form when payee loads
    useEffect(() => {
        if (payee) {
            setFormData({
                name: payee.name || '',
                email: payee.email || '',
                phone: payee.phone || '',
                address: payee.address || '',
                bank: payee.bank || '',
                account_number: payee.account_number || '',
                swift_iban: payee.swift_iban || '',
                bsb_bic: payee.bsb_bic || '',
                rollover: payee.rollover || false
            })
        }
    }, [payee])

    const handleChange = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        if (!campusId) return
        if (!formData.name.trim()) {
            toast.error('Name is required')
            return
        }

        setSaving(true)
        try {
            await accountingApi.updatePayee(payeeId, {
                campus_id: campusId,
                ...formData
            })
            toast.success('Payee updated successfully')
            mutatePayee()
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update payee'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!campusId) return
        if (!confirm('Are you sure you want to delete this payee?')) return

        setDeleting(true)
        try {
            await accountingApi.deletePayee(campusId, payeeId)
            toast.success('Payee deleted successfully')
            router.push('/admin/accounting/payees')
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete payee'
            toast.error(errorMessage)
        } finally {
            setDeleting(false)
        }
    }

    const handleAddPayment = async () => {
        if (!campusId) return
        if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
            toast.error('Amount is required')
            return
        }

        setSavingPayment(true)
        try {
            await accountingApi.createPayeePayment(payeeId, {
                campus_id: campusId,
                amount: parseFloat(paymentData.amount),
                payment_date: paymentData.payment_date,
                description: paymentData.description,
                reference_number: paymentData.reference_number
            })
            toast.success('Payment added successfully')
            setPaymentData({
                amount: '',
                payment_date: new Date().toISOString().split('T')[0],
                description: '',
                reference_number: ''
            })
            setShowPaymentForm(false)
            mutatePayments()
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to add payment'
            toast.error(errorMessage)
        } finally {
            setSavingPayment(false)
        }
    }

    const handleDeletePayment = async (paymentId: string) => {
        if (!campusId) return
        if (!confirm('Are you sure you want to delete this payment?')) return

        try {
            await accountingApi.deletePayeePayment(campusId, paymentId)
            toast.success('Payment deleted')
            mutatePayments()
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete payment'
            toast.error(errorMessage)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const totalPayments = useMemo(() => 
        payments.reduce((sum, p) => sum + Number(p.amount), 0), 
        [payments]
    )

    if (campusLoading || loadingPayee) {
        return (
            <div className="flex items-center justify-center h-64">
                <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!selectedCampus) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground text-center">Please select a campus.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!payee) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground text-center">Payee not found.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconUsers className="h-8 w-8 text-[#3d8fb5]" />
                    <h1 className="text-3xl font-bold tracking-tight">Payees</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline"
                        onClick={handleDelete}
                        disabled={deleting}
                    >
                        {deleting ? 'DELETING...' : 'DELETE'}
                    </Button>
                    <Button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#3d8fb5] hover:bg-[#357ea0]"
                    >
                        {saving ? 'SAVING...' : 'SAVE'}
                    </Button>
                </div>
            </div>

            {/* Back Link */}
            <div className="flex items-center gap-2">
                <Link href="/admin/accounting/payees" className="text-[#3d8fb5] hover:underline">
                    « Back
                </Link>
                <span className="font-medium">{payee.name}</span>
            </div>

            {/* Payee Details Form */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div>
                                <span className="text-sm underline">{formData.name}</span>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0 hidden"
                                />
                                <Label className="text-[#3d8fb5] text-xs block">Name</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.phone || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">Phone Number</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.bank || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">Bank</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.swift_iban || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">SWIFT or IBAN</Label>
                            </div>
                            <div className="pt-2">
                                <span className="text-sm underline">{formData.rollover ? 'Yes' : 'No'}</span>
                                <span className="text-sm ml-1">Rollover</span>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div>
                                <span className="text-sm underline">{formData.email || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">Email Address</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.address || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">Address</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.account_number || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">Account Number</Label>
                            </div>
                            <div>
                                <span className="text-sm underline">{formData.bsb_bic || '-'}</span>
                                <Label className="text-[#3d8fb5] text-xs block">BSB or BIC</Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Form (Hidden by default, toggle to show) */}
            <Card>
                <CardContent className="pt-6">
                    <h3 className="font-medium mb-4">Edit Details</h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Phone Number</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Bank</Label>
                                <Input
                                    value={formData.bank}
                                    onChange={(e) => handleChange('bank', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">SWIFT or IBAN</Label>
                                <Input
                                    value={formData.swift_iban}
                                    onChange={(e) => handleChange('swift_iban', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                    id="rollover"
                                    checked={formData.rollover}
                                    onCheckedChange={(checked) => handleChange('rollover', checked === true)}
                                />
                                <label htmlFor="rollover" className="text-sm cursor-pointer">
                                    Rollover
                                </label>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Email Address</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Address</Label>
                                <Input
                                    value={formData.address}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">Account Number</Label>
                                <Input
                                    value={formData.account_number}
                                    onChange={(e) => handleChange('account_number', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-[#3d8fb5] text-xs">BSB or BIC</Label>
                                <Input
                                    value={formData.bsb_bic}
                                    onChange={(e) => handleChange('bsb_bic', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-center">
                <Button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#3d8fb5] hover:bg-[#357ea0] px-8"
                >
                    {saving ? 'SAVING...' : 'SAVE'}
                </Button>
            </div>

            {/* Payments Section */}
            <div className="flex justify-end">
                <Link 
                    href="#payments"
                    className="text-[#3d8fb5] hover:underline"
                >
                    Payments
                </Link>
            </div>

            <Card id="payments">
                <CardContent className="pt-6">
                    <h3 className="font-medium mb-4">Payments History</h3>
                    
                    {loadingPayments ? (
                        <div className="flex items-center justify-center py-4">
                            <IconLoader className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : payments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">No payments recorded.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">DATE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">DESCRIPTION</TableHead>
                                    <TableHead className="text-[#3d8fb5]">REFERENCE</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">AMOUNT</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map(payment => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                                        <TableCell>{payment.description || '-'}</TableCell>
                                        <TableCell>{payment.reference_number || '-'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeletePayment(payment.id)}
                                            >
                                                <IconTrash className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-semibold bg-muted/50">
                                    <TableCell colSpan={3}>Total</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalPayments)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}

                    {/* Add Payment Form */}
                    {showPaymentForm ? (
                        <div className="mt-4 p-4 border rounded-lg space-y-4">
                            <h4 className="font-medium">Add Payment</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Amount</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={paymentData.amount}
                                        onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={paymentData.payment_date}
                                        onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Input
                                        value={paymentData.description}
                                        onChange={(e) => setPaymentData(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Optional description"
                                    />
                                </div>
                                <div>
                                    <Label>Reference Number</Label>
                                    <Input
                                        value={paymentData.reference_number}
                                        onChange={(e) => setPaymentData(prev => ({ ...prev, reference_number: e.target.value }))}
                                        placeholder="Optional reference"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={handleAddPayment}
                                    disabled={savingPayment}
                                    className="bg-[#3d8fb5] hover:bg-[#357ea0]"
                                >
                                    {savingPayment ? 'Saving...' : 'Add Payment'}
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => setShowPaymentForm(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            onClick={() => setShowPaymentForm(true)}
                            className="mt-4 text-[#3d8fb5]"
                        >
                            <IconPlus className="h-4 w-4 mr-2" />
                            Add Payment
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
