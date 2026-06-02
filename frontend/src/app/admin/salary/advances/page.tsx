'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { usePendingAdvances } from '@/hooks/useSalary'
import { processAdvance, formatMonthYear } from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { IconArrowLeft, IconCheck, IconX } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function AdvancesPage() {
    const t = useTranslations('admin.salary.advances')
    const tCommon = useTranslations('common')
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null
    const campusId = campusContext?.selectedCampus?.id
    const adminId = profile?.id || null

    const { data: advances, mutate } = usePendingAdvances(schoolId, campusId)

    const [selectedAdvance, setSelectedAdvance] = useState<any>(null)
    const [action, setAction] = useState<'approve' | 'reject'>('approve')
    const [recoveryMonth, setRecoveryMonth] = useState(new Date().getMonth() + 2)
    const [recoveryYear, setRecoveryYear] = useState(new Date().getFullYear())
    const [processing, setProcessing] = useState(false)

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: tCommon(`months.${i}`)
    }))

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }

    const handleProcess = async () => {
        if (!schoolId || !adminId || !selectedAdvance) return
        setProcessing(true)
        try {
            await processAdvance(selectedAdvance.id, {
                school_id: schoolId,
                action,
                admin_id: adminId,
                recovery_month: action === 'approve' ? recoveryMonth : undefined,
                recovery_year: action === 'approve' ? recoveryYear : undefined
            })
            mutate()
            setSelectedAdvance(null)
            toast.success(action === 'approve' ? t('toast.approved') : t('toast.rejected'))
        } catch (error: any) {
            toast.error(error.message)
        }
        setProcessing(false)
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/salary"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('table.title')}</CardTitle>
                    <CardDescription>{t('table.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {advances?.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">{t('table.empty')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('table.employee')}</TableHead>
                                    <TableHead>{t('table.employee_number')}</TableHead>
                                    <TableHead>{t('table.job_title')}</TableHead>
                                    <TableHead>{tCommon('amount')}</TableHead>
                                    <TableHead>{t('table.reason')}</TableHead>
                                    <TableHead>{t('table.request_date')}</TableHead>
                                    <TableHead className="text-right">{tCommon('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {advances?.map((adv: any) => (
                                    <TableRow key={adv.id}>
                                        <TableCell className="font-medium">
                                            {adv.staff?.profile?.first_name} {adv.staff?.profile?.last_name}
                                        </TableCell>
                                        <TableCell>{adv.staff?.employee_number || tCommon('na')}</TableCell>
                                        <TableCell>{adv.staff?.title || tCommon('na')}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(adv.amount)}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{adv.reason || '-'}</TableCell>
                                        <TableCell>{new Date(adv.request_date).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" onClick={() => { setSelectedAdvance(adv); setAction('approve') }}>
                                                    <IconCheck className="mr-1 h-4 w-4" />{tCommon('approved')}
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => { setSelectedAdvance(adv); setAction('reject') }}>
                                                    <IconX className="mr-1 h-4 w-4" />{tCommon('rejected')}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedAdvance} onOpenChange={(open) => !open && setSelectedAdvance(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{action === 'approve' ? t('dialog.approve_title') : t('dialog.reject_title')}</DialogTitle>
                        <DialogDescription>
                            {selectedAdvance && (
                                <>
                                    {selectedAdvance.staff?.profile?.first_name} {selectedAdvance.staff?.profile?.last_name} - {formatCurrency(selectedAdvance.amount)}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {action === 'approve' && (
                        <div className="space-y-4">
                            <Label>{t('dialog.recovery_month')}</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <Select value={recoveryMonth.toString()} onValueChange={(v) => setRecoveryMonth(parseInt(v))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {months.map((m) => (
                                            <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={recoveryYear.toString()} onValueChange={(v) => setRecoveryYear(parseInt(v))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2025">2025</SelectItem>
                                        <SelectItem value="2026">2026</SelectItem>
                                        <SelectItem value="2027">2027</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('dialog.recovery_note', { monthYear: formatMonthYear(recoveryMonth, recoveryYear) })}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedAdvance(null)}>{tCommon('cancel')}</Button>
                        <Button onClick={handleProcess} disabled={processing} variant={action === 'reject' ? 'destructive' : 'default'}>
                            {processing ? t('dialog.processing') : action === 'approve' ? tCommon('approved') : tCommon('rejected')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
