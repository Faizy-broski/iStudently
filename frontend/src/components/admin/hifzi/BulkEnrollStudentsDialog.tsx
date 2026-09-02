'use client'

import { useEffect, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Search, Users } from 'lucide-react'
import { enrollStudentsBulk, type HifziBulkEnrollResult } from '@/lib/api/hifzi'
// Same search endpoint as EnrollStudentDialog.tsx — see that file's comment
// for why the library-named search RPC is the right, already-existing tool.
import { searchStudents, type Student } from '@/lib/api/library'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

interface BulkEnrollStudentsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    circleId: string
    onEnrolled: () => void
    campusId?: string | null
}

export function BulkEnrollStudentsDialog({ open, onOpenChange, circleId, onEnrolled, campusId }: BulkEnrollStudentsDialogProps) {
    const t = useTranslations('hifzi.students')
    const { user } = useAuth()
    const [query, setQuery] = useState('')
    const debouncedQuery = useDebouncedValue(query, 300)
    const [results, setResults] = useState<Student[]>([])
    const [searching, setSearching] = useState(false)
    const [selected, setSelected] = useState<Map<string, Student>>(new Map())
    const [submitting, setSubmitting] = useState(false)

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
            setSelected(new Map())
        }
    }, [open])

    const toggle = (student: Student) => {
        setSelected((prev) => {
            const next = new Map(prev)
            if (next.has(student.id)) next.delete(student.id)
            else next.set(student.id, student)
            return next
        })
    }

    const studentLabel = (s: any) =>
        `${s.profile?.first_name || s.first_name || ''} ${s.profile?.last_name || s.last_name || ''}`.trim() || s.student_number || s.admission_number

    const handleSubmit = async () => {
        if (selected.size === 0) return
        setSubmitting(true)
        try {
            const res = await enrollStudentsBulk(circleId, [...selected.keys()], campusId)
            if (res.success && res.data) {
                const { success_count, error_count }: HifziBulkEnrollResult = res.data
                if (success_count > 0) toast.success(`Enrolled ${success_count} student(s)`)
                if (error_count > 0) toast.error(`${error_count} student(s) could not be enrolled`)
                onEnrolled()
                onOpenChange(false)
            } else {
                toast.error(res.error || 'Failed to enroll students')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Bulk Enroll
                    </DialogTitle>
                    <DialogDescription>{t('title')}</DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Name or student number"
                        className="ps-9"
                        autoComplete="off"
                    />
                    {searching && (
                        <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                    {query.trim().length < 2 ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">Type at least 2 characters to search</p>
                    ) : results.length === 0 && !searching ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">No students found</p>
                    ) : (
                        results.map((s) => (
                            <label
                                key={s.id}
                                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                            >
                                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s)} />
                                <span>{studentLabel(s)}</span>
                            </label>
                        ))
                    )}
                </div>

                {selected.size > 0 && (
                    <p className="text-xs text-muted-foreground">{selected.size} student(s) selected</p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={selected.size === 0 || submitting} className="gradient-blue text-white border-0">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                        Enroll {selected.size > 0 ? selected.size : ''} student{selected.size === 1 ? '' : 's'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
