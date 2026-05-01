'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { generateBulkSalaries, formatMonthYear } from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { IconArrowLeft, IconCalculator, IconLoader2, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function GenerateSalariesPage() {
    const t = useTranslations('admin.salary.generate')
    const tCommon = useTranslations('common')
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null
    const campusId = campusContext?.selectedCampus?.id

    const currentDate = new Date()
    const [month, setMonth] = useState(currentDate.getMonth() + 1)
    const [year, setYear] = useState(currentDate.getFullYear())
    const [generating, setGenerating] = useState(false)
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: tCommon(`months.${i}`)
    }))

    const years = [2024, 2025, 2026, 2027]

    const handleGenerate = async () => {
        if (!schoolId) {
            toast.error(t('toast.missing_school'))
            console.error('Missing schoolId:', { profile, schoolId })
            return
        }
        
        console.log('Starting salary generation:', { schoolId, campusId, month, year })
        setGenerating(true)
        setResult(null)
        
        try {
            const res = await generateBulkSalaries({
                school_id: schoolId,
                campus_id: campusId,
                month,
                year
            })
            console.log('Generation result:', res)
            setResult(res)
            if (res.success > 0) {
                toast.success(t('toast.generated_success', { count: res.success }))
            }
            if (res.failed > 0) {
                toast.warning(t('toast.generated_failed', { count: res.failed }))
            }
        } catch (error: any) {
            console.error('Generation error:', error)
            toast.error(error.message || t('toast.generate_error'))
        } finally {
            setGenerating(false)
        }
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

            {!schoolId && (
                <Alert variant="destructive">
                    <IconAlertCircle className="h-4 w-4" />
                    <AlertTitle>{tCommon('error')}</AlertTitle>
                    <AlertDescription>
                        {t('missing_school_desc')}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>{t('card.title')}</CardTitle>
                    <CardDescription>{t('card.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{t('filters.month')}</Label>
                            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {months.map((m) => (
                                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>{t('filters.year')}</Label>
                            <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm">{t('summary.intro', { monthYear: formatMonthYear(month, year) })}</p>
                        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>{t('summary.item_1')}</li>
                            <li>{t('summary.item_2')}</li>
                            <li>{t('summary.item_3')}</li>
                            <li>{t('summary.item_4')}</li>
                            <li>{t('summary.item_5')}</li>
                        </ul>
                    </div>

                    <Button 
                        onClick={handleGenerate} 
                        disabled={generating || !schoolId} 
                        className="w-full"
                        type="button"
                    >
                        {generating ? (
                            <>
                                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('actions.generating')}
                            </>
                        ) : (
                            <>
                                <IconCalculator className="mr-2 h-4 w-4" />
                                {t('actions.generate_all')}
                            </>
                        )}
                    </Button>

                    {!schoolId && (
                        <p className="text-sm text-destructive">
                            {t('cannot_generate_missing_school')}
                        </p>
                    )}

                    {result && (
                        <div className="space-y-3">
                            {result.success > 0 && (
                                <Alert>
                                    <IconCheck className="h-4 w-4" />
                                    <AlertTitle>{tCommon('success')}</AlertTitle>
                                    <AlertDescription>
                                        {t('result.success_count', { count: result.success })}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {result.failed > 0 && (
                                <Alert variant="destructive">
                                    <IconAlertCircle className="h-4 w-4" />
                                    <AlertTitle>{t('result.failed_title')}</AlertTitle>
                                    <AlertDescription>
                                        {t('result.failed_count', { count: result.failed })}:
                                        <ul className="mt-2 text-xs">
                                            {result.errors.map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
