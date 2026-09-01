'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search, UserPlus } from 'lucide-react'
import { enrollStudent } from '@/lib/api/hifzi'
// Reusing library's generic student-search endpoint (search_students_for_library
// RPC — despite the name, it searches by name/student number, nothing
// library-specific) rather than standing up a duplicate search endpoint for Hifzi.
import { searchStudents, type Student } from '@/lib/api/library'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

interface EnrollStudentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    circleId: string
    onEnrolled: () => void
    campusId?: string | null
}

export function EnrollStudentDialog({ open, onOpenChange, circleId, onEnrolled, campusId }: EnrollStudentDialogProps) {
    const t = useTranslations('hifzi.students')
    const { user } = useAuth()
    const [query, setQuery] = useState('')
    const debouncedQuery = useDebouncedValue(query, 300)
    const [results, setResults] = useState<Student[]>([])
    const [searching, setSearching] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [enrollingId, setEnrollingId] = useState<string | null>(null)
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Live, as-you-type search — the dropdown opens automatically once there's
    // enough to search on, no separate "Search" button/Enter press needed.
    useEffect(() => {
        const trimmed = debouncedQuery.trim()
        if (trimmed.length < 2 || !user?.access_token) {
            setResults([])
            setSearching(false)
            return
        }
        let cancelled = false
        setSearching(true)
        searchStudents(trimmed, user.access_token, campusId).then((res) => {
            if (cancelled) return
            if (res.success && res.data) setResults(res.data)
            setSearching(false)
        })
        return () => { cancelled = true }
    }, [debouncedQuery, user?.access_token, campusId])

    useEffect(() => {
        if (!open) {
            setQuery('')
            setResults([])
            setDropdownOpen(false)
        }
    }, [open])

    const handleEnroll = async (studentId: string) => {
        setEnrollingId(studentId)
        try {
            const res = await enrollStudent(circleId, studentId, campusId)
            if (res.success) {
                toast.success(t('enroll'))
                onEnrolled()
                setResults((prev) => prev.filter((s) => s.id !== studentId))
                setQuery('')
                setDropdownOpen(false)
            } else {
                toast.error(res.error || 'Failed to enroll')
            }
        } finally {
            setEnrollingId(null)
        }
    }

    // A plain onBlur would close the dropdown before a click on a result
    // registers — delay the close just long enough for that click to land,
    // and cancel it if focus returns to something inside the search box.
    const handleBlur = () => {
        blurTimeoutRef.current = setTimeout(() => setDropdownOpen(false), 150)
    }
    const cancelBlurClose = () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }

    const showDropdown = dropdownOpen && query.trim().length >= 2

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{t('enroll')}</DialogTitle>
                    <DialogDescription>{t('title')}</DialogDescription>
                </DialogHeader>

                <div className="relative" onBlur={handleBlur} onFocus={cancelBlurClose}>
                    <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true) }}
                            onFocus={() => setDropdownOpen(true)}
                            placeholder="Name or student number"
                            className="ps-9"
                            autoComplete="off"
                        />
                        {searching && (
                            <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                    </div>

                    {showDropdown && (
                        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
                            {searching && results.length === 0 ? (
                                <p className="p-3 text-sm text-muted-foreground text-center">Searching…</p>
                            ) : results.length === 0 ? (
                                <p className="p-3 text-sm text-muted-foreground text-center">No students found</p>
                            ) : (
                                results.map((s) => {
                                    // library.service.ts::searchStudents actually returns
                                    // { id, student_number, grade_level, profile: { first_name,
                                    // last_name, email } } — not the flat first_name/
                                    // admission_number/class_name the `Student` type in
                                    // lib/api/library.ts declares (that type is stale; see
                                    // IssueBookDialog.tsx, which already reads this same real
                                    // shape via student_number/grade_level/profile?.first_name).
                                    const student = s as any
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleEnroll(s.id)}
                                            disabled={enrollingId === s.id}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start hover:bg-accent disabled:opacity-60 border-b last:border-b-0"
                                        >
                                            <div>
                                                <p className="font-medium">
                                                    {student.profile?.first_name || student.first_name} {student.profile?.last_name || student.last_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {student.student_number || student.admission_number} · {student.grade_level || student.class_name || 'N/A'}
                                                </p>
                                            </div>
                                            {enrollingId === s.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                            ) : (
                                                <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
