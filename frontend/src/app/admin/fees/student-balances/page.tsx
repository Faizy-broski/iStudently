'use client'

import { useState, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import * as feesApi from '@/lib/api/fees'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconSearch, IconUsers, IconDownload } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface ParentLink {
    parent_id: string
    relationship: string
    parents: {
        id: string
        address: string | null
        city: string | null
        state: string | null
        zip_code: string | null
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

interface StudentBalance {
    student_id: string
    student_name: string
    student_number: string
    grade_level: string
    total_fees: number
    amount_paid: number
    balance: number
    ethnicity?: string
    gender?: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    parent_student_links?: ParentLink[]
}

interface FamilyGroup {
    familyId: string
    familyName: string
    students: StudentBalance[]
    totalBalance: number
}

// Fetch expanded student data with parent links
async function fetchStudentsWithParents(schoolId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const params = new URLSearchParams({ school_id: schoolId, limit: '500' })
    
    const res = await fetch(`${API_BASE}/api/fees/payments/students?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    if (!json.success) return []
    return json.data
}

type ViewMode = 'original' | 'expanded' | 'family'

export default function StudentBalancesPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const schoolId = selectedCampus?.id

    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<ViewMode>('original')

    // Fetch all student fees (includes student info)
    const { data: feesResponse, isLoading: feesLoading } = useSWR(
        schoolId ? ['student-fees-balances', schoolId] : null,
        () => feesApi.getStudentFees(schoolId!, { limit: 5000 }),
        { revalidateOnFocus: false }
    )

    // Fetch expanded student data with parent links
    const { data: studentsData } = useSWR(
        schoolId ? ['students-expanded', schoolId] : null,
        () => fetchStudentsWithParents(schoolId!),
        { revalidateOnFocus: false }
    )

    // Create a map of student data for quick lookup
    const studentDataMap = useMemo(() => {
        const map = new Map<string, any>()
        studentsData?.forEach((s: any) => map.set(s.id, s))
        return map
    }, [studentsData])

    // Calculate balances per student directly from fees data
    const studentBalances = useMemo(() => {
        const studentFees = feesResponse?.data || []
        if (studentFees.length === 0) return []

        const balanceMap = new Map<string, StudentBalance>()

        // Aggregate fees per student
        studentFees.forEach(fee => {
            const existing = balanceMap.get(fee.student_id)
            
            if (existing) {
                existing.total_fees += Number(fee.final_amount || 0)
                existing.amount_paid += Number(fee.amount_paid || 0)
                existing.balance = existing.total_fees - existing.amount_paid
            } else {
                // Get student info from the fee record
                const studentInfo = fee.students as { student_number: string; grade_level?: string; profiles: { first_name: string; last_name: string } } | undefined
                const firstName = studentInfo?.profiles?.first_name || ''
                const lastName = studentInfo?.profiles?.last_name || ''
                
                // Get expanded data from students API
                const expandedData = studentDataMap.get(fee.student_id)
                const customFields = expandedData?.custom_fields || {}
                const parentLinks = expandedData?.parent_student_links || []
                
                // Get address from custom_fields or parent
                let address = customFields.address || ''
                let city = customFields.city || ''
                let state = customFields.state || ''
                let zip_code = customFields.zip_code || ''
                
                if (!address && parentLinks.length > 0) {
                    const parent = parentLinks[0]?.parents
                    address = parent?.address || ''
                    city = parent?.city || ''
                    state = parent?.state || ''
                    zip_code = parent?.zip_code || ''
                }
                
                balanceMap.set(fee.student_id, {
                    student_id: fee.student_id,
                    student_name: `${firstName} ${lastName}`.trim() || 'Unknown',
                    student_number: studentInfo?.student_number || '-',
                    grade_level: studentInfo?.grade_level || '-',
                    total_fees: Number(fee.final_amount || 0),
                    amount_paid: Number(fee.amount_paid || 0),
                    balance: Number(fee.final_amount || 0) - Number(fee.amount_paid || 0),
                    ethnicity: customFields.ethnicity,
                    gender: customFields.gender,
                    address,
                    city,
                    state,
                    zip_code,
                    parent_student_links: parentLinks
                })
            }
        })

        // Convert to array and filter by search
        return Array.from(balanceMap.values())
            .filter(sb => {
                if (!searchQuery) return true
                const query = searchQuery.toLowerCase()
                return sb.student_name.toLowerCase().includes(query) ||
                       sb.student_number.toLowerCase().includes(query)
            })
            .sort((a, b) => a.student_name.localeCompare(b.student_name))
    }, [feesResponse, searchQuery, studentDataMap])

    // Group students by family (shared parent_id)
    const familyGroups = useMemo(() => {
        if (!studentBalances.length) return []
        
        const familyMap = new Map<string, FamilyGroup>()
        const noFamily: StudentBalance[] = []
        
        studentBalances.forEach(student => {
            const parentLinks = student.parent_student_links || []
            if (parentLinks.length === 0) {
                noFamily.push(student)
                return
            }
            
            // Use first parent's ID as family identifier
            const firstParent = parentLinks[0]?.parents
            if (!firstParent) {
                noFamily.push(student)
                return
            }
            
            const familyId = parentLinks[0].parent_id
            const familyName = `${firstParent.profiles?.first_name || ''} ${firstParent.profiles?.last_name || ''}`.trim() || 'Unknown Family'
            
            if (familyMap.has(familyId)) {
                const family = familyMap.get(familyId)!
                family.students.push(student)
                family.totalBalance += student.balance
            } else {
                familyMap.set(familyId, {
                    familyId,
                    familyName,
                    students: [student],
                    totalBalance: student.balance
                })
            }
        })
        
        // Add students without family as individual groups
        noFamily.forEach(student => {
            familyMap.set(`no-family-${student.student_id}`, {
                familyId: `no-family-${student.student_id}`,
                familyName: student.student_name,
                students: [student],
                totalBalance: student.balance
            })
        })
        
        return Array.from(familyMap.values()).sort((a, b) => a.familyName.localeCompare(b.familyName))
    }, [studentBalances])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    // Get balance color based on payment status
    const getBalanceColor = (sb: StudentBalance) => {
        if (sb.amount_paid === 0 && sb.total_fees > 0) return 'text-red-600'
        if (sb.amount_paid === sb.total_fees && sb.total_fees > 0) return 'text-green-600'
        return ''
    }

    // Calculate total balance
    const totalBalance = useMemo(() => {
        return studentBalances.reduce((sum, sb) => sum + sb.balance, 0)
    }, [studentBalances])

    // Handle export
    const handleExport = () => {
        if (!studentBalances.length) return
        
        const headers = viewMode === 'expanded' 
            ? ['Student', 'Student ID', 'Grade Level', 'Ethnicity', 'Gender', 'Address', 'City', 'State', 'Zip Code', 'Balance']
            : ['Student', 'Student ID', 'Grade Level', 'Balance']
        
        const rows = studentBalances.map(sb => {
            const baseRow = [sb.student_name, sb.student_number, sb.grade_level]
            if (viewMode === 'expanded') {
                return [...baseRow, sb.ethnicity || '', sb.gender || '', sb.address || '', sb.city || '', sb.state || '', sb.zip_code || '', formatCurrency(sb.balance)]
            }
            return [...baseRow, formatCurrency(sb.balance)]
        })
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'student_balances.csv'
        a.click()
        URL.revokeObjectURL(url)
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
                        <p className="text-muted-foreground text-center">Please select a campus to view student balances.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isLoading = feesLoading

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Student Balances</h1>
                <p className="text-muted-foreground">
                    View fee balances per student • {selectedCampus.name}
                </p>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 text-sm">
                <button
                    onClick={() => setViewMode('original')}
                    className={`hover:underline ${viewMode === 'original' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600'}`}
                >
                    Original View
                </button>
                <span>|</span>
                <button
                    onClick={() => setViewMode('expanded')}
                    className={`hover:underline ${viewMode === 'expanded' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600'}`}
                >
                    Expanded View
                </button>
                <span>|</span>
                <button
                    onClick={() => setViewMode('family')}
                    className={`hover:underline ${viewMode === 'family' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600'}`}
                >
                    Group by Family
                </button>
            </div>

            {/* Student Count and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">
                                {viewMode === 'family' 
                                    ? `${familyGroups.length} families (${studentBalances.length} students) were found.`
                                    : `${studentBalances.length} students were found.`
                                }
                            </p>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto"
                                onClick={handleExport}
                                title="Export to CSV"
                            >
                                <IconDownload className="h-5 w-5 text-gray-700" />
                            </Button>
                        </div>
                        <div className="relative">
                            <Input
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pr-8"
                            />
                            <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Student Balances Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : studentBalances.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No students found.</p>
                    ) : viewMode === 'family' ? (
                        // Family View
                        <div className="space-y-4">
                            {familyGroups.map(family => (
                                <div key={family.familyId} className="border rounded-lg overflow-hidden">
                                    <div className="bg-[#3d8fb5] text-white px-4 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <IconUsers className="h-4 w-4" />
                                            <span className="font-semibold">{family.familyName} Family</span>
                                            <span className="text-sm opacity-80">({family.students.length} student{family.students.length > 1 ? 's' : ''})</span>
                                        </div>
                                        <span className="font-semibold">Family Balance: {formatCurrency(family.totalBalance)}</span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-[#3d8fb5]">STUDENT</TableHead>
                                                <TableHead className="text-[#3d8fb5]">STUDENT ID</TableHead>
                                                <TableHead className="text-[#3d8fb5]">GRADE LEVEL</TableHead>
                                                <TableHead className="text-[#3d8fb5]">RELATIONSHIP</TableHead>
                                                <TableHead className="text-right text-[#3d8fb5]">BALANCE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {family.students.map(sb => (
                                                <TableRow key={sb.student_id}>
                                                    <TableCell>{sb.student_name}</TableCell>
                                                    <TableCell>{sb.student_number}</TableCell>
                                                    <TableCell>{sb.grade_level}</TableCell>
                                                    <TableCell className="capitalize">
                                                        {sb.parent_student_links?.[0]?.relationship || '-'}
                                                    </TableCell>
                                                    <TableCell className={`text-right ${getBalanceColor(sb)}`}>
                                                        {formatCurrency(sb.balance)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                            {/* Grand Total Row */}
                            <div className="bg-muted/50 px-4 py-3 rounded-lg flex justify-between items-center font-semibold">
                                <span>Grand Total ({studentBalances.length} students)</span>
                                <span>{formatCurrency(totalBalance)}</span>
                            </div>
                        </div>
                    ) : (
                        // Original or Expanded View
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">STUDENT</TableHead>
                                    <TableHead className="text-[#3d8fb5]">STUDENT ID</TableHead>
                                    <TableHead className="text-[#3d8fb5]">GRADE LEVEL</TableHead>
                                    {viewMode === 'expanded' && (
                                        <>
                                            <TableHead className="text-[#3d8fb5]">ETHNICITY</TableHead>
                                            <TableHead className="text-[#3d8fb5]">GENDER</TableHead>
                                            <TableHead className="text-[#3d8fb5]">ADDRESS</TableHead>
                                            <TableHead className="text-[#3d8fb5]">CITY</TableHead>
                                            <TableHead className="text-[#3d8fb5]">STATE</TableHead>
                                            <TableHead className="text-[#3d8fb5]">ZIP CODE</TableHead>
                                        </>
                                    )}
                                    <TableHead className="text-right text-[#3d8fb5]">BALANCE</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {studentBalances.map(sb => (
                                    <TableRow key={sb.student_id}>
                                        <TableCell>{sb.student_name}</TableCell>
                                        <TableCell>{sb.student_number}</TableCell>
                                        <TableCell>{sb.grade_level}</TableCell>
                                        {viewMode === 'expanded' && (
                                            <>
                                                <TableCell>{sb.ethnicity || '-'}</TableCell>
                                                <TableCell>{sb.gender || '-'}</TableCell>
                                                <TableCell>{sb.address || '-'}</TableCell>
                                                <TableCell>{sb.city || '-'}</TableCell>
                                                <TableCell>{sb.state || '-'}</TableCell>
                                                <TableCell>{sb.zip_code || '-'}</TableCell>
                                            </>
                                        )}
                                        <TableCell className={`text-right ${getBalanceColor(sb)}`}>
                                            {formatCurrency(sb.balance)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Total Row */}
                                <TableRow className="font-semibold bg-muted/50">
                                    <TableCell colSpan={viewMode === 'expanded' ? 9 : 3}>Total</TableCell>
                                    <TableCell className="text-right">
                                        {formatCurrency(totalBalance)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
