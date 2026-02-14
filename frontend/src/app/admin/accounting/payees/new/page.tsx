'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { IconLoader, IconUsers } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import * as accountingApi from '@/lib/api/accounting'

export default function NewPayeePage() {
    const router = useRouter()
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    const [saving, setSaving] = useState(false)
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
            await accountingApi.createPayee({
                campus_id: campusId,
                ...formData
            })
            toast.success('Payee created successfully')
            router.push('/admin/accounting/payees')
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create payee'
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    if (campusLoading) {
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

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconUsers className="h-8 w-8 text-[#3d8fb5]" />
                    <h1 className="text-3xl font-bold tracking-tight">Payees</h1>
                </div>
                <Button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#3d8fb5] hover:bg-[#357ea0]"
                >
                    {saving ? 'SAVING...' : 'SAVE'}
                </Button>
            </div>

            {/* Back Link */}
            <div className="flex items-center gap-2">
                <Link href="/admin/accounting/payees" className="text-[#3d8fb5] hover:underline">
                    « Back
                </Link>
                <span className="text-muted-foreground">Add a Payee</span>
            </div>

            {/* Form */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                        {/* Left Column */}
                        <div className="space-y-4">
                            <div>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Name</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Phone Number</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.bank}
                                    onChange={(e) => handleChange('bank', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Bank</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.swift_iban}
                                    onChange={(e) => handleChange('swift_iban', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">SWIFT or IBAN</Label>
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
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder="Email"
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Email Address</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.address}
                                    onChange={(e) => handleChange('address', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Address</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.account_number}
                                    onChange={(e) => handleChange('account_number', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">Account Number</Label>
                            </div>
                            <div>
                                <Input
                                    value={formData.bsb_bic}
                                    onChange={(e) => handleChange('bsb_bic', e.target.value)}
                                    placeholder=""
                                    className="border-0 border-b rounded-none focus-visible:ring-0 px-0"
                                />
                                <Label className="text-[#3d8fb5] text-xs">BSB or BIC</Label>
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
        </div>
    )
}
