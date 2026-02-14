'use client'

import { useState, useEffect } from 'react'
// import { useSchoolDashboard } from '@/hooks/useSchoolDashboard'
import { useFeeSettings, useSiblingDiscountTiers } from '@/hooks/useFees'
import { updateFeeSettings, updateSiblingDiscountTiers } from '@/lib/api/fees'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconArrowLeft, IconPlus, IconTrash, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

export default function FeeSettingsPage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || null

    const { data: settings, mutate: mutateSettings } = useFeeSettings(schoolId)
    const { data: siblingTiers, mutate: mutateTiers } = useSiblingDiscountTiers(schoolId)

    // Settings form state
    const [enableLateFees, setEnableLateFees] = useState(true)
    const [lateFeeType, setLateFeeType] = useState<'percentage' | 'fixed'>('percentage')
    const [lateFeeValue, setLateFeeValue] = useState(5)
    const [graceDays, setGraceDays] = useState(7)
    const [enableSiblingDiscounts, setEnableSiblingDiscounts] = useState(true)
    const [discountForfeitureEnabled, setDiscountForfeitureEnabled] = useState(true)
    const [adminCanRestoreDiscounts, setAdminCanRestoreDiscounts] = useState(true)
    const [allowPartialPayments, setAllowPartialPayments] = useState(true)
    const [minPartialPaymentPercent, setMinPartialPaymentPercent] = useState(25)

    // Sibling tiers
    const [tiers, setTiers] = useState<Array<{ sibling_count: number; discount_type: 'percentage' | 'fixed'; discount_value: number }>>([])

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (settings) {
            setEnableLateFees(settings.enable_late_fees)
            setLateFeeType(settings.late_fee_type)
            setLateFeeValue(settings.late_fee_value)
            setGraceDays(settings.grace_days)
            setEnableSiblingDiscounts(settings.enable_sibling_discounts)
            setDiscountForfeitureEnabled(settings.discount_forfeiture_enabled)
            setAdminCanRestoreDiscounts(settings.admin_can_restore_discounts)
            setAllowPartialPayments(settings.allow_partial_payments)
            setMinPartialPaymentPercent(settings.min_partial_payment_percent)
        }
    }, [settings])

    useEffect(() => {
        if (siblingTiers) {
            setTiers(siblingTiers.map(t => ({
                sibling_count: t.sibling_count,
                discount_type: t.discount_type,
                discount_value: t.discount_value
            })))
        }
    }, [siblingTiers])

    const handleSaveSettings = async () => {
        if (!schoolId) return
        setSaving(true)
        try {
            await updateFeeSettings(schoolId, {
                enable_late_fees: enableLateFees,
                late_fee_type: lateFeeType,
                late_fee_value: lateFeeValue,
                grace_days: graceDays,
                enable_sibling_discounts: enableSiblingDiscounts,
                discount_forfeiture_enabled: discountForfeitureEnabled,
                admin_can_restore_discounts: adminCanRestoreDiscounts,
                allow_partial_payments: allowPartialPayments,
                min_partial_payment_percent: minPartialPaymentPercent
            })
            mutateSettings()
            toast.success('Settings saved successfully')
        } catch (error: any) {
            toast.error(error.message)
        }
        setSaving(false)
    }

    const handleSaveTiers = async () => {
        if (!schoolId) return
        try {
            await updateSiblingDiscountTiers(schoolId, tiers.map(t => ({
                school_id: schoolId,
                ...t,
                applies_to_categories: []
            })))
            mutateTiers()
            toast.success('Sibling discounts saved')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const addTier = () => {
        const nextCount = tiers.length > 0 ? Math.max(...tiers.map(t => t.sibling_count)) + 1 : 2
        setTiers([...tiers, { sibling_count: nextCount, discount_type: 'percentage', discount_value: 5 }])
    }

    const removeTier = (index: number) => {
        setTiers(tiers.filter((_, i) => i !== index))
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/fees"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Fee Settings</h1>
                    <p className="text-muted-foreground">Configure fee rules and discounts</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/admin/fees/structures">
                        Fee Structures →
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="general" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="services">Services</TabsTrigger>
                    <TabsTrigger value="sibling">Sibling Discounts</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Late Fee Settings</CardTitle>
                            <CardDescription>Configure late payment penalties</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Enable Late Fees</Label>
                                <Switch checked={enableLateFees} onCheckedChange={setEnableLateFees} />
                            </div>
                            {enableLateFees && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label>Late Fee Type</Label>
                                            <Select value={lateFeeType} onValueChange={(v) => setLateFeeType(v as any)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percentage">Percentage</SelectItem>
                                                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Value {lateFeeType === 'percentage' ? '(%)' : '($)'}</Label>
                                            <Input type="number" value={lateFeeValue} onChange={(e) => setLateFeeValue(parseFloat(e.target.value))} />
                                        </div>
                                        <div>
                                            <Label>Grace Days</Label>
                                            <Input type="number" value={graceDays} onChange={(e) => setGraceDays(parseInt(e.target.value))} />
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Discount Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Enable Sibling Discounts</Label>
                                <Switch checked={enableSiblingDiscounts} onCheckedChange={setEnableSiblingDiscounts} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Forfeit Discount on Late Payment</Label>
                                <Switch checked={discountForfeitureEnabled} onCheckedChange={setDiscountForfeitureEnabled} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Admin Can Restore Forfeited Discounts</Label>
                                <Switch checked={adminCanRestoreDiscounts} onCheckedChange={setAdminCanRestoreDiscounts} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Allow Partial Payments</Label>
                                <Switch checked={allowPartialPayments} onCheckedChange={setAllowPartialPayments} />
                            </div>
                            {allowPartialPayments && (
                                <div>
                                    <Label>Minimum Partial Payment (%)</Label>
                                    <Input type="number" value={minPartialPaymentPercent} onChange={(e) => setMinPartialPaymentPercent(parseFloat(e.target.value))} className="w-32" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Button onClick={handleSaveSettings} disabled={saving}>
                        <IconDeviceFloppy className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </TabsContent>

                <TabsContent value="services">
                    <Card>
                        <CardHeader>
                            <CardTitle>School Services</CardTitle>
                            <CardDescription>
                                Configure optional services (Bus, Meals, etc.) that students can subscribe to
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border p-4 text-center text-muted-foreground">
                                <p className="mb-2">Services management is available in the dedicated Services page</p>
                                <Button variant="outline" asChild>
                                    <Link href="/admin/fees/services">
                                        Manage Services →
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sibling">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sibling Discount Tiers</CardTitle>
                            <CardDescription>Configure discounts based on number of siblings enrolled</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Siblings</TableHead>
                                        <TableHead>Discount Type</TableHead>
                                        <TableHead>Value</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tiers.map((tier, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Input type="number" value={tier.sibling_count} onChange={(e) => {
                                                    const newTiers = [...tiers]
                                                    newTiers[index].sibling_count = parseInt(e.target.value)
                                                    setTiers(newTiers)
                                                }} className="w-20" />
                                            </TableCell>
                                            <TableCell>
                                                <Select value={tier.discount_type} onValueChange={(v) => {
                                                    const newTiers = [...tiers]
                                                    newTiers[index].discount_type = v as any
                                                    setTiers(newTiers)
                                                }}>
                                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="percentage">Percentage</SelectItem>
                                                        <SelectItem value="fixed">Fixed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={tier.discount_value} onChange={(e) => {
                                                    const newTiers = [...tiers]
                                                    newTiers[index].discount_value = parseFloat(e.target.value)
                                                    setTiers(newTiers)
                                                }} className="w-24" />
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeTier(index)}>
                                                    <IconTrash className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={addTier}><IconPlus className="mr-2 h-4 w-4" />Add Tier</Button>
                                <Button onClick={handleSaveTiers}><IconDeviceFloppy className="mr-2 h-4 w-4" />Save Tiers</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
