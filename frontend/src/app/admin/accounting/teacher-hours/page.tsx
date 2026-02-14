'use client'

import { useState, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconSearch, IconClock } from '@tabler/icons-react'
import useSWR from 'swr'
import Link from 'next/link'
import * as accountingApi from '@/lib/api/accounting'
import type { TeacherWithHours } from '@/lib/api/accounting'

export default function TeacherHoursPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    const [searchQuery, setSearchQuery] = useState('')

    // Fetch teachers list
    const { data: teachersResponse, isLoading } = useSWR(
        campusId ? ['teacher-hours-list', campusId] : null,
        () => accountingApi.getTeachersWithHours(campusId!),
        { revalidateOnFocus: false }
    )

    const teachers: TeacherWithHours[] = useMemo(() => teachersResponse?.data || [], [teachersResponse?.data])

    // Filter teachers by search
    const filteredTeachers = useMemo(() => {
        if (!searchQuery) return teachers
        const query = searchQuery.toLowerCase()
        return teachers.filter(t => {
            const fullName = `${t.profile?.first_name || ''} ${t.profile?.last_name || ''}`.toLowerCase()
            return fullName.includes(query) || t.employee_number?.toLowerCase().includes(query)
        })
    }, [teachers, searchQuery])

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
                        <p className="text-muted-foreground text-center">Please select a campus to view teacher hours.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <IconClock className="h-8 w-8 text-[#3d8fb5]" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Teacher Hours</h1>
                    <p className="text-muted-foreground">
                        Profile: Teacher
                    </p>
                </div>
            </div>

            {/* Count and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {filteredTeachers.length} teachers were found.
                        </p>
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

            {/* Teachers Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredTeachers.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No hourly teachers found. Teachers with &quot;Hourly&quot; payment type will appear here.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">TEACHER</TableHead>
                                    <TableHead className="text-[#3d8fb5]">STUDENTLY ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTeachers.map(teacher => {
                                    const fullName = `${teacher.profile?.first_name || ''} ${teacher.profile?.last_name || ''}`.trim()
                                    
                                    return (
                                        <TableRow key={teacher.id}>
                                            <TableCell>
                                                <Link 
                                                    href={`/admin/accounting/teacher-hours/${teacher.id}`}
                                                    className="text-[#3d8fb5] hover:underline"
                                                >
                                                    {fullName}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{teacher.employee_number || '-'}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
