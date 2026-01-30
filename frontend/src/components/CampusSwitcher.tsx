'use client'

import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Building2, Loader2 } from 'lucide-react'
import { Campus } from '@/lib/api/setup-status'

export function CampusSwitcher() {
    const { profile } = useAuth()
    const campusContext = useCampus()

    // Only show for admin role
    if (profile?.role !== 'admin') {
        return null
    }

    // CampusContext not available (outside provider)
    if (!campusContext) {
        return null
    }

    const { campuses, selectedCampus, setSelectedCampus, loading } = campusContext

    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
                <span className="text-sm text-gray-500">Loading...</span>
            </div>
        )
    }

    // No campuses yet - show message
    if (campuses.length === 0) {
        return (
            <div className="flex items-center gap-2 text-sm text-orange-600">
                <Building2 className="h-4 w-4" />
                <span>No campuses</span>
            </div>
        )
    }

    const handleCampusChange = (campusId: string) => {
        const campus = campuses.find((c: Campus) => c.id === campusId)
        if (campus) {
            setSelectedCampus(campus)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#022172]" />
            <Select
                value={selectedCampus?.id || ''}
                onValueChange={handleCampusChange}
            >
                <SelectTrigger className="w-[180px] h-9 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 text-sm font-medium">
                    <SelectValue placeholder="Select Campus" />
                </SelectTrigger>
                <SelectContent>
                    {campuses.map((campus: Campus) => (
                        <SelectItem key={campus.id} value={campus.id}>
                            {campus.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
