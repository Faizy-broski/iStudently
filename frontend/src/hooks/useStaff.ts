import useSWR, { mutate } from 'swr'
import { getAllStaff, getStaffById } from '@/lib/api/staff'

export function useStaff(
    page = 1,
    limit = 10,
    search?: string,
    role: 'staff' | 'librarian' | 'all' = 'all',
    campusId?: string
) {
    // Include campusId in cache key to auto-refresh when campus changes
    const { data, error, isLoading } = useSWR(
        [`/api/staff`, page, limit, search, role, campusId],
        () => getAllStaff(page, limit, search, role, campusId)
    )

    return {
        staff: data?.data?.data || [],
        total: data?.data?.total || 0,
        totalPages: data?.data?.totalPages || 0,
        isLoading,
        isError: error,
        mutate: () => mutate([`/api/staff`, page, limit, search, role, campusId])
    }
}

export function useStaffMember(id: string | null) {
    const { data, error, isLoading } = useSWR(
        id ? `/api/staff/${id}` : null,
        () => id ? getStaffById(id) : null
    )

    return {
        staffMember: data?.data,
        isLoading,
        isError: error
    }
}
