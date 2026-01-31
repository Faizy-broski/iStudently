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

// Cache duration - 10 minutes
const CACHE_DURATION = 10 * 60 * 1000
const CACHE_KEY = 'studently_campus_cache'
const SELECTED_CAMPUS_KEY = 'selectedCampusId'

// Helper to get cached data from sessionStorage
function getCachedCampuses(): { campuses: Campus[], timestamp: number, schoolId: string } | null {
    if (typeof window === 'undefined') return null
    try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
            return JSON.parse(cached)
        }
    } catch {
        // Invalid cache, ignore
    }
    return null
}

// Helper to save cache to sessionStorage
function setCampusCache(campuses: Campus[], schoolId: string) {
    if (typeof window === 'undefined') return
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            campuses,
            timestamp: Date.now(),
            schoolId
        }))
    } catch {
        // Storage full or unavailable, ignore
    }
}

export function CampusProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth()
    
    // Initialize from cache if available
    const [campuses, setCampuses] = useState<Campus[]>(() => {
        const cached = getCachedCampuses()
        return cached?.campuses || []
    })
    
    const [selectedCampus, setSelectedCampus] = useState<Campus | null>(() => {
        if (typeof window === 'undefined') return null
        const cached = getCachedCampuses()
        const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
        if (cached?.campuses && savedCampusId) {
            return cached.campuses.find(c => c.id === savedCampusId) || null
        }
        return null
    })
    
    // Start with loading=false if we have cached data
    const [loading, setLoading] = useState(() => {
        const cached = getCachedCampuses()
        return !cached?.campuses?.length
    })
    
    // Update selected campus and save to localStorage
    const handleSetSelectedCampus = (campus: Campus | null) => {
        if (campus) {
            localStorage.setItem(SELECTED_CAMPUS_KEY, campus.id)
            setSelectedCampus(campus)
        } else {
            setSelectedCampus(null)
        }
    }

    const refreshCampuses = async (forceRefresh = false) => {
        if (!profile?.school_id || profile.role !== 'admin') {
            setLoading(false)
            return
        }

        // Check if we have valid cached data
        const cached = getCachedCampuses()
        const now = Date.now()
        
        if (
            !forceRefresh &&
            cached && 
            cached.schoolId === profile.school_id &&
            now - cached.timestamp < CACHE_DURATION &&
            cached.campuses.length > 0
        ) {
            // Use cached data
            if (campuses.length === 0) {
                setCampuses(cached.campuses)
            }
            
            // Ensure selected campus is set
            if (!selectedCampus && cached.campuses.length > 0) {
                const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
                const savedCampus = savedCampusId ? cached.campuses.find(c => c.id === savedCampusId) : null
                setSelectedCampus(savedCampus || cached.campuses[0])
            }
            
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const data = await getCampuses()
            setCampuses(data)
            setCampusCache(data, profile.school_id)

            // Auto-select first campus if none selected or if selected is not in list
            if (data.length > 0) {
                if (!selectedCampus || !data.find(c => c.id === selectedCampus.id)) {
                    const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
                    const savedCampus = savedCampusId ? data.find(c => c.id === savedCampusId) : null
                    setSelectedCampus(savedCampus || data[0])
                }
            }
        } catch (error) {
            // Silent fail
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.school_id, profile?.role])

    return (
        <CampusContext.Provider value={{
            campuses,
            selectedCampus,
            setSelectedCampus: handleSetSelectedCampus,
            loading,
            refreshCampuses: () => refreshCampuses(true)
        }}>
            {children}
        </CampusContext.Provider>
    )
}

export function useCampus() {
    const context = useContext(CampusContext)
    return context
}
