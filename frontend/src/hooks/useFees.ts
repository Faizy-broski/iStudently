'use client'

import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import {
    getFeeSettings,
    getFeeCategories,
    getSiblingDiscountTiers,
    getStudentFees,
    getFeeDashboardStats,
    type FeeSettings,
    type FeeCategory,
    type SiblingDiscountTier,
    type StudentFee
} from '@/lib/api/fees'

export function useFeeSettings(schoolId: string | null) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['fee-settings', schoolId, campusContext?.selectedCampus?.id] : null,
        () => getFeeSettings(schoolId!)
    )
}

export function useFeeCategories(schoolId: string | null) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['fee-categories', schoolId, campusContext?.selectedCampus?.id] : null,
        () => getFeeCategories(schoolId!)
    )
}

export function useSiblingDiscountTiers(schoolId: string | null) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['sibling-discount-tiers', schoolId, campusContext?.selectedCampus?.id] : null,
        () => getSiblingDiscountTiers(schoolId!)
    )
}

export function useStudentFees(
    schoolId: string | null,
    options?: { studentId?: string; academicYear?: string; status?: string; page?: number; limit?: number }
) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['student-fees', schoolId, campusContext?.selectedCampus?.id, JSON.stringify(options)] : null,
        () => getStudentFees(schoolId!, options)
    )
}

export function useFeeDashboardStats(schoolId: string | null, academicYear?: string) {
    const campusContext = useCampus()
    return useSWR(
        schoolId ? ['fee-dashboard-stats', schoolId, campusContext?.selectedCampus?.id, academicYear] : null,
        () => getFeeDashboardStats(schoolId!, academicYear)
    )
}
