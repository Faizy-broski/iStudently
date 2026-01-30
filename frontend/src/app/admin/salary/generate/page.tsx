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

export default function GenerateSalariesPage() {
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null
    const campusId = campusContext?.selectedCampus?.id

    const currentDate = new Date()
    const [month, setMonth] = useState(currentDate.getMonth() + 1)
    const [year, setYear] = useState(currentDate.getFullYear())
    const [generating, setGenerating] = useState(false)
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ]

    const years = [2024, 2025, 2026, 2027]

    const handleGenerate = async () => {
        if (!schoolId) {
            toast.error('School ID not found. Please ensure you are logged in.')
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
                toast.success(`Generated ${res.success} salary records`)
            }
            if (res.failed > 0) {
                toast.warning(`${res.failed} failed to generate`)
            }
        } catch (error: any) {
            console.error('Generation error:', error)
            toast.error(error.message || 'Failed to generate salaries')
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
                    <h1 className="text-3xl font-bold tracking-tight">Generate Salaries</h1>
                    <p className="text-muted-foreground">Calculate monthly salaries for all staff</p>
                </div>
            </div>

            {!schoolId && (
                <Alert variant="destructive">
                    <IconAlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        School ID not found. Please ensure you are logged in with proper permissions.
                    </AlertDescription>
                </Alert>
            )}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Bulk Salary Generation</CardTitle>
                    <CardDescription>Generate salary records for all staff with salary structures</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Month</Label>
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
                            <Label>Year</Label>
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
                        <p className="text-sm">
                            This will generate salary records for <strong>{formatMonthYear(month, year)}</strong> including:
                        </p>
                        <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>Base salary from staff salary structure</li>
                            <li>All configured allowances</li>
                            <li>Attendance-based deductions (late arrivals, absences)</li>
                            <li>Attendance bonus (if perfect attendance)</li>
                            <li>Salary advance deductions (if any due)</li>
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
                                Generating...
                            </>
                        ) : (
                            <>
                                <IconCalculator className="mr-2 h-4 w-4" />
                                Generate All Salaries
                            </>
                        )}
                    </Button>

                    {!schoolId && (
                        <p className="text-sm text-destructive">
                            Cannot generate: School ID is missing
                        </p>
                    )}

                    {result && (
                        <div className="space-y-3">
                            {result.success > 0 && (
                                <Alert>
                                    <IconCheck className="h-4 w-4" />
                                    <AlertTitle>Success</AlertTitle>
                                    <AlertDescription>
                                        Generated {result.success} salary record(s)
                                    </AlertDescription>
                                </Alert>
                            )}
                            {result.failed > 0 && (
                                <Alert variant="destructive">
                                    <IconAlertCircle className="h-4 w-4" />
                                    <AlertTitle>Failed</AlertTitle>
                                    <AlertDescription>
                                        {result.failed} record(s) failed:
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
