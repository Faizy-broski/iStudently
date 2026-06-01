import useSWR, { mutate as globalMutate } from 'swr'
import { useMemo } from 'react'
import { 
    getDesignations, 
    getDesignationsGrouped
} from '@/lib/api/staff-designations'

/**
 * Hook to fetch staff designations with SWR caching
 * If campusId is provided, returns both campus-specific AND school-wide designations
 */
export function useStaffDesignations(campusId?: string) {
    // Memoize the SWR key to prevent unnecessary refetches
    const swrKey = useMemo(() => {
        return ['staff-designations', campusId || 'school-wide']
    }, [campusId])

    const { data, error, isLoading, mutate } = useSWR(
        swrKey,
        () => getDesignations(campusId),
        {
            dedupingInterval: 60000, // 60 seconds deduplication
            revalidateOnFocus: false,
            revalidateIfStale: false,
            refreshInterval: 0, // No auto-refresh
        }
    )

    const designations = useMemo(() => {
        return data?.success ? data.data || [] : []
    }, [data])

    // Separate system vs custom designations
    const systemDesignations = useMemo(() => {
        return designations.filter(d => d.is_system)
    }, [designations])

    const customDesignations = useMemo(() => {
        return designations.filter(d => !d.is_system)
    }, [designations])

    // Separate school-wide vs campus-specific
    const schoolWideDesignations = useMemo(() => {
        return designations.filter(d => !d.campus_id)
    }, [designations])

    const campusSpecificDesignations = useMemo(() => {
        return designations.filter(d => d.campus_id)
    }, [designations])

    return {
        designations,
        systemDesignations,
        customDesignations,
        schoolWideDesignations,
        campusSpecificDesignations,
        isLoading,
        isError: error,
        mutate,
        // Helper to invalidate all designation caches
        invalidateAll: () => {
            globalMutate((key: unknown) => {
                if (Array.isArray(key) && key[0] === 'staff-designations') {
                    return true
                }
                return false
            })
        }
    }
}

/**
 * Hook to fetch all designations grouped by campus
 */
export function useStaffDesignationsGrouped() {
    const { data, error, isLoading, mutate } = useSWR(
        ['staff-designations-grouped'],
        () => getDesignationsGrouped(),
        {
            dedupingInterval: 60000,
            revalidateOnFocus: false,
            revalidateIfStale: false,
            refreshInterval: 0,
        }
    )

    const grouped = useMemo(() => {
        if (!data?.success || !data.data) {
            return { schoolWide: [], byCampus: {} }
        }
        return data.data
    }, [data])

    return {
        schoolWideDesignations: grouped.schoolWide,
        designationsByCampus: grouped.byCampus,
        isLoading,
        isError: error,
        mutate
    }
}
