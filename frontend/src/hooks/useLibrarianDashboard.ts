'use client'

import useSWR from 'swr'
import { API_URL } from '@/config/api'
import { getAuthToken } from '@/lib/api/schools'

interface LibraryStats {
    total_books: number;
    total_copies: number;
    available_copies: number;
    issued_copies: number;
    lost_copies: number;
    active_loans: number;
    overdue_loans: number;
    total_fines_collected: number;
    pending_fines: number;
    recent_loans: Array<{
        id: string;
        book_title: string;
        issue_date: string;
        due_date: string;
        status: string;
    }>;
    overdue_list: Array<{
        id: string;
        book_title: string;
        student_name: string;
        due_date: string;
        days_overdue: number;
    }>;
}

const fetchLibraryStats = async (): Promise<LibraryStats> => {
    const token = await getAuthToken()
    const response = await fetch(`${API_URL}/library/stats`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
    const data = await response.json()
    if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stats')
    }
    return data.data
}

export function useLibrarianDashboard() {
    const { data: stats, error, isLoading, isValidating, mutate } = useSWR<LibraryStats>(
        'librarian-dashboard-stats',
        fetchLibraryStats,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            dedupingInterval: 30000, // 30 seconds
            errorRetryCount: 3,
        }
    )

    return {
        stats,
        loading: isLoading,
        error: error?.message || null,
        isValidating,
        refreshDashboard: mutate,
    }
}
