'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCampuses, Campus } from '@/lib/api/setup-status'

interface CampusContextType {
    campuses: Campus[]
    selectedCampus: Campus | null
    setSelectedCampus: (campus: Campus | null) => void
    loading: boolean
    refreshCampuses: () => Promise<void>
}

const CampusContext = createContext<CampusContextType | undefined>(undefined)

export function CampusProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth()
    const [campuses, setCampuses] = useState<Campus[]>([])
    const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null)
    const [loading, setLoading] = useState(true)
    
    // Update selected campus and save to localStorage
    // SWR will automatically refetch data when campus changes since it's in the cache keys
    const handleSetSelectedCampus = (campus: Campus | null) => {
        if (campus) {
            localStorage.setItem('selectedCampusId', campus.id)
            setSelectedCampus(campus)
        } else {
            setSelectedCampus(null)
        }
    }

    const refreshCampuses = async () => {
        console.log('🏢 refreshCampuses called', {
            school_id: profile?.school_id,
            role: profile?.role
        })

        if (!profile?.school_id || profile.role !== 'admin') {
            console.log('🏢 Skipping - not admin or no school_id')
            setLoading(false)
            return
        }

        try {
            console.log('🏢 Fetching campuses...')
            const data = await getCampuses()
            console.log('🏢 Campuses received:', data)
            setCampuses(data)

            // Auto-select first campus if none selected or if selected is not in list
            if (data.length > 0) {
                if (!selectedCampus || !data.find(c => c.id === selectedCampus.id)) {
                    // Check if there's a saved campus in localStorage
                    const savedCampusId = localStorage.getItem('selectedCampusId')
                    const savedCampus = savedCampusId ? data.find(c => c.id === savedCampusId) : null
                    setSelectedCampus(savedCampus || data[0])
                }
            }
        } catch (error) {
            console.error('🏢 Error fetching campuses:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (profile?.school_id && profile?.role === 'admin') {
            refreshCampuses()
        } else {
            setLoading(false)
        }
        // Only run when profile changes, not when selectedCampus changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.school_id, profile?.role])

    return (
        <CampusContext.Provider value={{
            campuses,
            selectedCampus,
            setSelectedCampus: handleSetSelectedCampus,
            loading,
            refreshCampuses
        }}>
            {children}
        </CampusContext.Provider>
    )
}

export function useCampus() {
    const context = useContext(CampusContext)
    // Return null if used outside provider (e.g., on super_admin pages)
    return context
}
