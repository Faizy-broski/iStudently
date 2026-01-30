'use client'

import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import {
    getPayrollSettings,
    getSalaryStructures,
    getSalaryRecords,
    getPendingAdvances,
    getSalaryDashboardStats,
    type PayrollSettings,
    type SalaryStructure,
    type SalaryRecord,
    type SalaryAdvance
} from '@/lib/api/salary'

export function usePayrollSettings(schoolId: string | null, campusId?: string) {
    return useSWR(
        schoolId ? ['payroll-settings', schoolId, campusId] : null,
        () => getPayrollSettings(schoolId!, campusId)
    )
}

export function useSalaryStructures(schoolId: string | null) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['salary-structures', schoolId, campusContext?.selectedCampus?.id] : null,
        () => getSalaryStructures(schoolId!)
    )
}

export function useSalaryRecords(
    schoolId: string | null,
    options?: { month?: number; year?: number; status?: string; page?: number; limit?: number; campus_id?: string }
) {
    return useSWR(
        schoolId ? ['salary-records', schoolId, options?.campus_id, JSON.stringify(options)] : null,
        () => getSalaryRecords(schoolId!, options)
    )
}

export function usePendingAdvances(schoolId: string | null, campusId?: string) {
    return useSWR(
        schoolId ? ['pending-advances', schoolId, campusId] : null,
        () => getPendingAdvances(schoolId!, campusId)
    )
}

export function useSalaryDashboardStats(schoolId: string | null, month?: number, year?: number) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['salary-dashboard-stats', schoolId, campusContext?.selectedCampus?.id, month, year] : null,
        () => getSalaryDashboardStats(schoolId!, month, year)
    )
}
