'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getCampuses, getCampusById, Campus } from '@/lib/api/setup-status'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'

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

// Compute the effective school id (accounting for super-admin impersonation) outside
// the component so both the useState initializers and the rest of the component agree
// on the exact same value at the exact same time (no risk of reading it twice and racing).
function getEffectiveSchoolId(profileSchoolId: string | null | undefined): string | null {
    return profileSchoolId ?? (typeof window !== 'undefined' ? sessionStorage.getItem('impersonatedSchoolId') : null)
}

export function CampusProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth()

    // Super admin impersonation: use the impersonated school_id when profile has none
    const effectiveSchoolId: string | null = getEffectiveSchoolId(profile?.school_id)

    // Initialize from cache if available — but only if the cache actually belongs to the
    // current effective school. Otherwise a previously-impersonated (or previous session's)
    // school's campus data/logo would flash on screen before the fetch below corrects it.
    const [campuses, setCampuses] = useState<Campus[]>(() => {
        const cached = getCachedCampuses()
        if (cached?.campuses && cached.schoolId === effectiveSchoolId) return cached.campuses
        return []
    })

    const [selectedCampus, setSelectedCampus] = useState<Campus | null>(() => {
        if (typeof window === 'undefined') return null
        const cached = getCachedCampuses()
        if (cached?.schoolId !== effectiveSchoolId) return null
        const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
        if (cached?.campuses && savedCampusId) {
            return cached.campuses.find(c => c.id === savedCampusId) || null
        }
        return null
    })

    // Start with loading=false if we have cached data for the current effective school
    const [loading, setLoading] = useState(() => {
        const cached = getCachedCampuses()
        return !(cached?.campuses?.length && cached.schoolId === effectiveSchoolId)
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
        if (!effectiveSchoolId) {
            setLoading(false)
            return
        }

        // For non-admin/librarian roles, fetch their single assigned campus
        // super_admin is treated like admin so campus list loads during impersonation
        if (!profile || (profile.role !== 'admin' && profile.role !== 'librarian' && profile.role !== 'super_admin')) {
            const hasCorrectCampus = selectedCampus?.id === profile.campus_id
            if (profile.campus_id && !hasCorrectCampus) {
                try {
                    setLoading(true)
                    const campus = await getCampusById(profile.campus_id)
                    if (campus) {
                        setCampuses([campus])
                        setSelectedCampus(campus)
                        setCampusCache([campus], profile.school_id)
                        localStorage.setItem(SELECTED_CAMPUS_KEY, campus.id)
                    }
                } catch {
                    // Silent fail
                } finally {
                    setLoading(false)
                }
            } else {
                setLoading(false)
            }
            return
        }

        // Librarians always get a fresh fetch — their campus list is small (usually 1 campus)
        // and we must not show stale data from a previous session or admin context.
        const effectiveForceRefresh = forceRefresh || profile.role === 'librarian'
        // Check if we have valid cached data
        const cached = getCachedCampuses()
        const now = Date.now()

        if (
            !effectiveForceRefresh &&
            cached &&
            cached.schoolId === effectiveSchoolId &&
            now - cached.timestamp < CACHE_DURATION &&
            cached.campuses.length > 0
        ) {
            // Use cached data
            if (campuses.length === 0) {
                setCampuses(cached.campuses)
            }

            // Ensure selected campus is set
            if (!selectedCampus && cached.campuses.length > 0) {
                // For librarians, always prioritise their assigned campus
                if (profile.role === 'librarian' && profile.campus_id) {
                    const librarianCampus = cached.campuses.find(c => c.id === profile.campus_id)
                    setSelectedCampus(librarianCampus || cached.campuses[0])
                } else {
                    const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
                    const savedCampus = savedCampusId ? cached.campuses.find(c => c.id === savedCampusId) : null
                    setSelectedCampus(savedCampus || cached.campuses[0])
                }
            }

            setLoading(false)
            return
        }

        // CRITICAL: Only show loading state if we have NO data yet
        // If we already have campuses, do a SILENT background refresh to avoid flicker
        const hasExistingData = campuses.length > 0 || (cached?.campuses?.length ?? 0) > 0

        try {
            if (!hasExistingData) {
                setLoading(true)
            }
            // If we have existing data, continue showing it while fetching fresh data

            let data = await getCampuses()

            // Fallback for librarians: if the campus list is empty but we know the librarian's
            // campus_id, fetch that specific campus directly so the sidebar is always populated.
            if (data.length === 0 && profile.role === 'librarian' && profile.campus_id) {
                try {
                    const singleCampus = await getCampusById(profile.campus_id)
                    if (singleCampus) {
                        data = [singleCampus]
                    }
                } catch {
                    // Silent fail — remain with empty list
                }
            }

            setCampuses(data)
            setCampusCache(data, effectiveSchoolId!)

            // Auto-select first campus if none selected or if selected is not in list
            if (data.length > 0) {
                // For librarian, auto-select their assigned campus
                if (profile.role === 'librarian' && profile.campus_id) {
                    const librarianCampus = data.find(c => c.id === profile.campus_id)
                    if (librarianCampus) {
                        setSelectedCampus(librarianCampus)
                    } else {
                        setSelectedCampus(data[0])
                    }
                } else if (!selectedCampus || !data.find(c => c.id === selectedCampus.id)) {
                    const savedCampusId = localStorage.getItem(SELECTED_CAMPUS_KEY)
                    const savedCampus = savedCampusId ? data.find(c => c.id === savedCampusId) : null
                    setSelectedCampus(savedCampus || data[0])
                } else {
                    // Campus is still in the list — always update the reference so consumers
                    // receive the freshly-fetched object (e.g. after editing campus details).
                    const freshCampus = data.find(c => c.id === selectedCampus.id)
                    if (freshCampus) setSelectedCampus(freshCampus)
                }
            }
        } catch {
            // Silent fail - don't show errors to user
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let isMounted = true

        const loadCampuses = async () => {
            if (effectiveSchoolId) {
                try {
                    await refreshCampuses(false)
                } catch {
                    // Silently ignore errors
                }
            } else {
                if (isMounted) setLoading(false)
            }
        }

        loadCampuses()

        return () => {
            isMounted = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveSchoolId, profile?.role, profile?.campus_id])

    // Refetch data when tab becomes visible again
    useVisibilityRefetch(
        useCallback(() => {
            if (effectiveSchoolId) {
                refreshCampuses(true) // Force refresh when returning to tab
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [effectiveSchoolId, profile?.role, profile?.campus_id])
    )

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
