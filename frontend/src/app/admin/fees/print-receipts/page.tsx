'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { useSchoolSettings as useSchoolSettingsHook } from '@/hooks/useSchoolSettings'
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from '@/lib/api/school-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelectPopover } from '@/components/shared/MultiSelectPopover'
import { IconLoader, IconSearch, IconReceipt, IconFilter, IconRefresh, IconDownload } from '@tabler/icons-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { openPrintPreview } from '@/lib/utils/printLayout'
import { useTranslations } from 'next-intl'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface GradeLevel {
    id: string
    name: string
    order_index: number
}

interface Section {
    id: string
    name: string
    grade_level_id: string
}

interface Payment {
    id: string
    amount: number
    payment_date: string
    payment_method?: string
    comment?: string
    is_lunch_payment: boolean
    created_at: string
    receipt_number?: string
    created_by_profile?: {
        first_name: string
        last_name: string
    }
    student_fee_id: string
}

interface ParentLink {
    parent_id: string
    relationship: string
    parents: {
        id: string
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

interface StudentWithPayments {
    id: string
    student_number: string
    profiles: {
        first_name: string
        last_name: string
    }
    grade_levels?: {
        id: string
        name: string
    }
    sections?: {
        name: string
    }
    payments: Payment[]
    balance: number
    parent_student_links?: ParentLink[]
}

// One printed page's worth of receipt content for a single student: every
// selected payment for them, plus their current outstanding balance (not
// just what's being receipted here) so the printout doubles as a balance statement.
interface StudentReceiptGroup {
    student: StudentWithPayments
    payments: Payment[]
    totalPaid: number
    balance: number
}

interface FamilyReceiptGroup {
    familyId: string
    familyName: string
    members: StudentReceiptGroup[]
    totalFamilyBalance: number
}

async function fetchGrades(schoolId: string): Promise<GradeLevel[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch(`${API_BASE}/api/academics/grades?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

// Fetches all sections for the campus (no grade filter) — the grade↔section
// cascade is applied client-side since a receipts filter may span multiple
// selected grades at once.
async function fetchSections(schoolId: string): Promise<Section[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE}/api/academics/sections?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

async function fetchStudentsWithPayments(schoolId: string, gradeIds?: string[], sectionIds?: string[]): Promise<StudentWithPayments[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const params = new URLSearchParams({ school_id: schoolId })
    if (gradeIds && gradeIds.length > 0) params.set('grade_id', gradeIds.join(','))
    if (sectionIds && sectionIds.length > 0) params.set('section_id', sectionIds.join(','))

    const res = await fetch(`${API_BASE}/api/fees/payments/all-with-students?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    if (!json.success) return []
    return json.data as StudentWithPayments[]
}

export default function PrintReceiptsPage() {
    const t = useTranslations('fees.printReceipts')
    const tf = useTranslations('fees.balances')
    const tp = useTranslations('fees.payments')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { isPluginActive } = useSchoolSettings()
    const { formatCurrency } = useSchoolSettingsHook()
    const schoolId = selectedCampus?.id

    const [pdfSettings, setPdfSettings] = useState<PdfHeaderFooterSettings | null>(null)
    useEffect(() => {
        if (schoolId && isPluginActive('pdf_header_footer')) {
            getPdfHeaderFooter(schoolId).then(r => { if (r.success && r.data) setPdfSettings(r.data) })
        } else {
            setPdfSettings(null)
        }
    }, [schoolId, isPluginActive])

    const [gradeIds, setGradeIds] = useState<string[]>([])
    const [sectionIds, setSectionIds] = useState<string[]>([])
    const [gradePopoverOpen, setGradePopoverOpen] = useState(false)
    const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
    const [selectAll, setSelectAll] = useState(false)
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [minAmount, setMinAmount] = useState<string>('')
    const [maxAmount, setMaxAmount] = useState<string>('')
    const [combineByFamily, setCombineByFamily] = useState(false)

    const printRef = useRef<HTMLDivElement>(null)

    // Fetch grades
    const { data: grades } = useSWR<GradeLevel[]>(
        schoolId ? ['grades-receipts', schoolId] : null,
        () => fetchGrades(schoolId!)
    )

    // Fetch all sections for the campus
    const { data: allSections } = useSWR<Section[]>(
        schoolId ? `sections-receipts-${schoolId}` : null,
        () => fetchSections(schoolId!)
    )

    // Sections available for the currently-selected grades (cascading filter).
    const sections = gradeIds.length > 0
        ? allSections?.filter(s => gradeIds.includes(s.grade_level_id))
        : allSections

    // Drop any selected section that's no longer visible once the grade selection narrows.
    useEffect(() => {
        if (gradeIds.length === 0 || !sections) return
        const visibleIds = new Set(sections.map(s => s.id))
        setSectionIds(prev => prev.filter(id => visibleIds.has(id)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeIds.join(',')])

    // Fetch students with payments
    const { data: studentsWithPayments, isLoading } = useSWR<StudentWithPayments[]>(
        schoolId ? ['students-payments-receipts', schoolId, gradeIds.join(','), sectionIds.join(',')] : null,
        () => fetchStudentsWithPayments(schoolId!, gradeIds, sectionIds)
    )

    // Flatten payments with student info for table display
    const allPayments = studentsWithPayments?.flatMap(student => 
        student.payments.map(payment => ({
            ...payment,
            student
        }))
    ) || []

    // Filter payments by search, date range, and amount range
    const filteredPayments = allPayments.filter(p => {
        // Search filter
        if (searchQuery) {
            const name = `${p.student.profiles.first_name} ${p.student.profiles.last_name}`.toLowerCase()
            const receipt = (p.receipt_number || '').toLowerCase()
            const idNum = p.student.student_number?.toLowerCase() || ''
            if (!name.includes(searchQuery.toLowerCase()) && 
                !idNum.includes(searchQuery.toLowerCase()) &&
                !receipt.includes(searchQuery.toLowerCase())) {
                return false
            }
        }
        // Date range filter (payment_date)
        if (dateFrom && p.payment_date < dateFrom) return false
        if (dateTo && p.payment_date > dateTo) return false
        // Amount range filter
        const amountValue = p.amount || 0
        if (minAmount && amountValue < parseFloat(minAmount)) return false
        if (maxAmount && amountValue > parseFloat(maxAmount)) return false
        return true
    })

    // Reset filters
    const handleResetFilters = () => {
        setGradeIds([])
        setSectionIds([])
        setSearchQuery('')
        setDateFrom('')
        setDateTo('')
        setMinAmount('')
        setMaxAmount('')
        setSelectedPayments(new Set())
        setSelectAll(false)
    }

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    // Format student name
    const formatStudentName = (student: StudentWithPayments) => {
        const { first_name, last_name } = student.profiles
        return `${first_name} ${last_name}`
    }

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked)
        if (checked) {
            setSelectedPayments(new Set(filteredPayments.map(p => p.id)))
        } else {
            setSelectedPayments(new Set())
        }
    }

    // Handle individual select
    const handleSelect = (paymentId: string, checked: boolean) => {
        const newSelected = new Set(selectedPayments)
        if (checked) {
            newSelected.add(paymentId)
        } else {
            newSelected.delete(paymentId)
        }
        setSelectedPayments(newSelected)
        setSelectAll(newSelected.size === filteredPayments.length)
    }

    // Get selected payments for printing
    const paymentsToPrint = filteredPayments.filter(p => selectedPayments.has(p.id))

    // Group the selected payments by student — one printed page per student,
    // listing every one of their selected payments (with dates) together,
    // instead of the old one-page-per-payment layout.
    const studentReceiptGroups: StudentReceiptGroup[] = (() => {
        const map = new Map<string, StudentReceiptGroup>()
        paymentsToPrint.forEach(p => {
            const sid = p.student.id
            let group = map.get(sid)
            if (!group) {
                group = { student: p.student, payments: [], totalPaid: 0, balance: p.student.balance }
                map.set(sid, group)
            }
            group.payments.push(p)
            group.totalPaid += p.amount
        })
        return Array.from(map.values())
    })()

    // Family lookup built from the whole loaded roster (not just selected payments) so a
    // family's total balance reflects every sibling, even ones with nothing selected here.
    const familyByStudentId = (() => {
        const map = new Map<string, { familyId: string; familyName: string }>()
        studentsWithPayments?.forEach(s => {
            const link = s.parent_student_links?.[0]
            const parent = link?.parents
            if (!link || !parent) return
            const familyName = `${parent.profiles?.first_name || ''} ${parent.profiles?.last_name || ''}`.trim()
            map.set(s.id, { familyId: link.parent_id, familyName: familyName || t('title') })
        })
        return map
    })()

    // Families to print: seeded from students with selected payments, then expanded to
    // include every other sibling on the loaded roster so the family total is complete.
    const familyReceiptGroups: FamilyReceiptGroup[] = combineByFamily ? (() => {
        const byFamily = new Map<string, { familyName: string; studentIds: Set<string> }>()
        studentReceiptGroups.forEach(g => {
            const fam = familyByStudentId.get(g.student.id)
            if (!fam) return
            if (!byFamily.has(fam.familyId)) byFamily.set(fam.familyId, { familyName: fam.familyName, studentIds: new Set() })
            byFamily.get(fam.familyId)!.studentIds.add(g.student.id)
        })
        studentsWithPayments?.forEach(s => {
            const fam = familyByStudentId.get(s.id)
            if (fam && byFamily.has(fam.familyId)) byFamily.get(fam.familyId)!.studentIds.add(s.id)
        })
        return Array.from(byFamily.entries()).map(([familyId, fam]) => {
            const members: StudentReceiptGroup[] = Array.from(fam.studentIds).map(sid => {
                const existing = studentReceiptGroups.find(g => g.student.id === sid)
                if (existing) return existing
                const studentRecord = studentsWithPayments!.find(s => s.id === sid)!
                return { student: studentRecord, payments: [], totalPaid: 0, balance: studentRecord.balance }
            })
            return {
                familyId,
                familyName: fam.familyName,
                members,
                totalFamilyBalance: members.reduce((sum, m) => sum + m.balance, 0),
            }
        })
    })() : []

    // Students with selected payments but no family link at all still get their own page in family mode.
    const soloReceiptGroups: StudentReceiptGroup[] = combineByFamily
        ? studentReceiptGroups.filter(g => !familyByStudentId.has(g.student.id))
        : studentReceiptGroups

    // Download PDF handler using openPdfDownload
    const handlePrint = useCallback(() => {
        const printContent = printRef.current
        if (!printContent) return

        const bodyHtml = printContent.innerHTML
        const bodyStyles = `
            .receipt { border: 2px solid #333; padding: 24px; margin-bottom: 32px; break-after: page; page-break-after: always; }
            .receipt:last-child { break-after: auto; page-break-after: auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 16px; }
            .header .receipt-date { font-size: 12px; color: #888; margin-bottom: 10px; }
            .header .logo-wrap { display: block; margin: 0 auto 10px; }
            .header .logo-wrap img { height: 64px; width: auto; object-fit: contain; display: block; margin: 0 auto; }
            .header .logo-wrap .logo-initial { height: 64px; width: 64px; display: flex; align-items: center; justify-content: center; background: #1e3a5f; border-radius: 8px; color: #fff; font-size: 28px; font-weight: 800; margin: 0 auto; }
            .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
            .header .receipt-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
            .info-grid .right { text-align: right; }
            .amount-box { background: #f0f0f0; border: 1px solid #ddd; padding: 16px 24px; text-align: center; margin-bottom: 24px; display: flex; justify-content: space-around; }
            .amount-box .stat .label { color: #666; font-size: 13px; margin-bottom: 6px; }
            .amount-box .stat .amount { font-size: 26px; font-weight: bold; }
            .amount-box .stat.paid .amount { color: #16a34a; }
            .amount-box .stat.balance .amount { color: #dc2626; }
            .amount-box .stat.balance.zero .amount { color: #16a34a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background: #f0f0f0; }
            .payments-table th { width: auto; font-size: 12px; text-transform: uppercase; }
            .payments-table td.amount-col { text-align: right; font-weight: 600; }
            .payments-table tfoot td { font-weight: bold; background: #fafafa; }
            .info-table th { width: 40%; }
            .member-block { border: 1px solid #ccc; padding: 16px; margin-bottom: 16px; }
            .member-block h3 { display: flex; justify-content: space-between; font-size: 15px; margin: 0 0 10px; }
            .member-block h3 .member-balance { color: #dc2626; }
            .member-block h3 .member-balance.zero { color: #16a34a; }
            .family-total { background: #f0f0f0; border: 2px solid #333; padding: 16px 24px; text-align: center; margin-bottom: 24px; }
            .family-total .label { color: #666; font-size: 14px; margin-bottom: 8px; }
            .family-total .amount { font-size: 28px; font-weight: bold; color: #dc2626; }
            .family-total .amount.zero { color: #16a34a; }
            .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #333; padding-top: 16px; }
            .footer .date { font-size: 12px; color: #666; }
            .footer .signature { text-align: center; }
            .footer .signature-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 48px; width: 200px; }
            @media print {
              .receipt { break-after: page; page-break-after: always; }
              .receipt:last-child { break-after: auto; page-break-after: auto; }
            }
        `

        const school = {
            name: selectedCampus?.name || '',
            address: selectedCampus?.address,
            phone: selectedCampus?.phone,
            logo_url: selectedCampus?.logo_url,
        }

        openPrintPreview({
            title: t('title'),
            bodyHtml,
            bodyStyles,
            school,
            // Receipt branding is embedded in each card header — no outer PDF header needed
            pluginActive: false,
        })
    }, [pdfSettings, selectedCampus, isPluginActive])

    const renderReceiptHeader = (isFamily: boolean) => (
        <div className="header">
            <p className="receipt-date">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <div className="logo-wrap">
                {selectedCampus?.logo_url
                    ? <img src={selectedCampus.logo_url} alt="" />
                    : <div className="logo-initial">{(selectedCampus?.name || 'S').charAt(0).toUpperCase()}</div>
                }
            </div>
            <h1>{selectedCampus?.name || 'School Name'}</h1>
            <p className="receipt-label">{isFamily ? t('familyReceiptLabel') : t('receiptTitle')}</p>
        </div>
    )

    const renderReceiptFooter = () => (
        <div className="footer">
            <div className="date">
                <p>{t('generatedOn')}: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="signature">
                <div className="signature-line">
                    <p>{t('authorizedSignature')}</p>
                </div>
            </div>
        </div>
    )

    const renderPaymentsTable = (payments: Payment[]) => (
        <table className="payments-table">
            <thead>
                <tr>
                    <th>{t('th_paymentDate')}</th>
                    <th>{t('th_receipt')}</th>
                    <th>{t('th_method')}</th>
                    <th>{t('th_comment')}</th>
                    <th className="amount-col">{t('amountPaid')}</th>
                </tr>
            </thead>
            <tbody>
                {payments.map((p) => (
                    <tr key={p.id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td>{p.receipt_number || `RCP-${p.id.substring(0, 8).toUpperCase()}`}</td>
                        <td>{p.payment_method || t('cash')}</td>
                        <td>{p.comment || '-'}</td>
                        <td className="amount-col">{formatCurrency(p.amount)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={4}>{t('totalPaid')}</td>
                    <td className="amount-col">{formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}</td>
                </tr>
            </tfoot>
        </table>
    )

    const renderStudentReceipt = (group: StudentReceiptGroup) => (
        <div key={group.student.id} className="receipt">
            {renderReceiptHeader(false)}
            <div className="info-grid">
                <div>
                    <p><strong>{t('student')}:</strong> {formatStudentName(group.student)}</p>
                    <p><strong>ID:</strong> {group.student.student_number || '-'}</p>
                    <p><strong>{t('th_gradeLevel')}:</strong> {group.student.grade_levels?.name || '-'}</p>
                </div>
            </div>
            {renderPaymentsTable(group.payments)}
            <div className="amount-box">
                <div className="stat paid">
                    <p className="label">{t('totalPaid')}</p>
                    <p className="amount">{formatCurrency(group.totalPaid)}</p>
                </div>
                <div className={`stat balance ${group.balance > 0 ? '' : 'zero'}`}>
                    <p className="label">{t('remainingBalance')}</p>
                    <p className="amount">{formatCurrency(group.balance)}</p>
                </div>
            </div>
            {renderReceiptFooter()}
        </div>
    )

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
                        <p className="text-muted-foreground text-center">{t('selectCampus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <IconReceipt className="h-8 w-8 text-[#3d8fb5]" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IconFilter className="h-5 w-5" />
                        {t('filterPayments')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                        <IconRefresh className="h-4 w-4 mr-1" />
                        {t('reset')}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Row 1: Grade, Section, Search */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>{tf('th_gradeLevel') || 'Grade Level'}</Label>
                            <MultiSelectPopover
                                options={(grades || []).map(g => ({ id: g.id, label: g.name }))}
                                selectedIds={gradeIds}
                                onChange={setGradeIds}
                                placeholder={t('allGrades')}
                                emptyMessage={t('allGrades')}
                                open={gradePopoverOpen}
                                onOpenChange={setGradePopoverOpen}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{tf('section') || 'Section'}</Label>
                            <MultiSelectPopover
                                options={(sections || []).map(s => ({ id: s.id, label: s.name }))}
                                selectedIds={sectionIds}
                                onChange={setSectionIds}
                                placeholder={t('allSections')}
                                emptyMessage={gradeIds.length === 0 ? t('selectGradeFirst') : t('allSections')}
                                open={sectionPopoverOpen}
                                onOpenChange={setSectionPopoverOpen}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('searchStudent') || 'Search Student'}</Label>
                            <div className="relative">
                                <Input
                                    placeholder={t('searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-8"
                                />
                                <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={() => handlePrint()}
                                disabled={selectedPayments.size === 0}
                                className="bg-[#3d8fb5] hover:bg-[#357a9e] w-full"
                            >
                                <IconDownload className="h-4 w-4 mr-2" />
                                {t('downloadPdf', { count: selectedPayments.size })}
                            </Button>
                        </div>
                    </div>
                    {/* Row 2: Date Range, Amount Range */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>{t('paymentDateFrom')}</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('paymentDateTo')}</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('minAmount')}</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('maxAmount')}</Label>
                            <Input
                                type="number"
                                placeholder="Any"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* Row 3: Combine by family */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="combine-by-family"
                            checked={combineByFamily}
                            onCheckedChange={(checked) => setCombineByFamily(checked as boolean)}
                        />
                        <Label htmlFor="combine-by-family" className="cursor-pointer font-normal">
                            {tp('groupByFamily')}
                        </Label>
                    </div>
                </CardContent>
            </Card>

            {/* Payments Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('noPayments')}</p>
                    ) : (
                        <Table className="w-full text-sm bg-white dark:bg-slate-950">
                            <TableHeader>
                                <TableRow className="bg-gray-100 dark:bg-slate-800">
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={selectAll}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('student') || 'STUDENT'}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">ID</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('th_gradeLevel') || 'GRADE'}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('th_paymentDate')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('th_receipt')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd] text-right">{t('amountPaid')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('th_method')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] dark:text-[#93c5fd]">{t('th_comment')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.map((payment, index) => (
                                    <TableRow 
                                        key={payment.id}
                                        className={index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-gray-50 dark:bg-slate-900'}
                                    >
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedPayments.has(payment.id)}
                                                onCheckedChange={(checked) => handleSelect(payment.id, checked as boolean)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatStudentName(payment.student)}
                                        </TableCell>
                                        <TableCell>{payment.student.student_number || '-'}</TableCell>
                                        <TableCell>{payment.student.grade_levels?.name || '-'}</TableCell>
                                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                                        <TableCell>{payment.receipt_number || '-'}</TableCell>
                                        <TableCell className="text-end font-medium text-green-600">
                                            {formatCurrency(payment.amount)}
                                        </TableCell>
                                        <TableCell>{payment.payment_method || t('cash') || 'Cash'}</TableCell>
                                        <TableCell className="max-w-50 truncate">{payment.comment || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Print Template (Hidden) */}
            <div className="hidden">
                <div ref={printRef}>
                    {combineByFamily ? (
                        <>
                            {familyReceiptGroups.map((family) => (
                                <div key={family.familyId} className="receipt">
                                    {renderReceiptHeader(true)}
                                    <p style={{ textAlign: 'center', fontWeight: 600, marginBottom: 16 }}>
                                        {tp('familyOf', { name: family.familyName })}
                                    </p>
                                    {family.members.map((member) => (
                                        <div key={member.student.id} className="member-block">
                                            <h3>
                                                <span>
                                                    {formatStudentName(member.student)} ({member.student.student_number || '-'}) — {member.student.grade_levels?.name || '-'}
                                                </span>
                                                <span className={`member-balance ${member.balance > 0 ? '' : 'zero'}`}>
                                                    {t('remainingBalance')}: {formatCurrency(member.balance)}
                                                </span>
                                            </h3>
                                            {member.payments.length > 0 ? (
                                                renderPaymentsTable(member.payments)
                                            ) : (
                                                <p style={{ fontStyle: 'italic', color: '#888', fontSize: 13 }}>{t('noPayments')}</p>
                                            )}
                                        </div>
                                    ))}
                                    <div className="family-total">
                                        <p className="label">{t('familyTotalBalance')}</p>
                                        <p className={`amount ${family.totalFamilyBalance > 0 ? '' : 'zero'}`}>
                                            {formatCurrency(family.totalFamilyBalance)}
                                        </p>
                                    </div>
                                    {renderReceiptFooter()}
                                </div>
                            ))}
                            {soloReceiptGroups.map((group) => renderStudentReceipt(group))}
                        </>
                    ) : (
                        studentReceiptGroups.map((group) => renderStudentReceipt(group))
                    )}
                </div>
            </div>
        </div>
    )
}
