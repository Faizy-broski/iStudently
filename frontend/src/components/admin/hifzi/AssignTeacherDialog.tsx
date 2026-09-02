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
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { addCircleTeacher, removeCircleTeacher, type HifziCircle } from '@/lib/api/hifzi'
import { getAllTeachers, type Staff } from '@/lib/api/teachers'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { toast } from 'sonner'

interface AssignTeacherDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    circle: HifziCircle
    onChanged: () => void
    campusId?: string | null
}

// The one piece of Hifzi circle setup with no UI until now: the backend
// (POST/DELETE /hifzi/circles/:id/teachers) has always supported this —
// nothing was missing server-side — but there was no way to actually call
// it from the admin screens, so hifzi_circle_teachers stayed empty for
// every circle. That's more than a missing convenience: with the
// circle-assignment authorization check in hifzi-access.ts, a teacher with
// zero hifzi_circle_teachers rows can't access any student/circle data at
// all, so this dialog is what makes a circle actually usable by a teacher.
export function AssignTeacherDialog({ open, onOpenChange, circle, onChanged, campusId }: AssignTeacherDialogProps) {
    const t = useTranslations('hifzi.circles')
    const [query, setQuery] = useState('')
    const debouncedQuery = useDebouncedValue(query, 300)
    const [results, setResults] = useState<Staff[]>([])
    const [searching, setSearching] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    const activeTeachers = (circle.hifzi_circle_teachers || []).filter((ct) => !ct.active_to)
    const assignedProfileIds = new Set(activeTeachers.map((ct) => ct.teacher_profile_id))

    useEffect(() => {
        if (!open) return
        setSearching(true)
        getAllTeachers({ campus_id: campusId ?? undefined, search: debouncedQuery.trim() || undefined, limit: 50 })
            .then((res) => setResults(res.data || []))
            .catch(() => toast.error('Failed to load teachers'))
            .finally(() => setSearching(false))
    }, [open, debouncedQuery, campusId])

    useEffect(() => {
        if (!open) setQuery('')
    }, [open])

    const handleAssign = async (teacherProfileId: string) => {
        setBusyId(teacherProfileId)
        try {
            const res = await addCircleTeacher(circle.id, teacherProfileId, 'lead', campusId)
            if (res.success) {
                toast.success('Teacher assigned')
                onChanged()
            } else {
                toast.error(res.error || 'Failed to assign teacher')
            }
        } finally {
            setBusyId(null)
        }
    }

    const handleRemove = async (teacherProfileId: string) => {
        setBusyId(teacherProfileId)
        try {
            const res = await removeCircleTeacher(circle.id, teacherProfileId, campusId)
            if (res.success) {
                toast.success('Teacher removed')
                onChanged()
            } else {
                toast.error(res.error || 'Failed to remove teacher')
            }
        } finally {
            setBusyId(null)
        }
    }

    const teacherLabel = (s: Staff) =>
        `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim() || s.employee_number

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{t('teachers')}</DialogTitle>
                    <DialogDescription>{circle.name_ar}</DialogDescription>
                </DialogHeader>

                {activeTeachers.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Currently assigned</p>
                        <div className="rounded-md border divide-y">
                            {activeTeachers.map((ct) => {
                                const staff = results.find((s) => s.profile_id === ct.teacher_profile_id)
                                return (
                                    <div key={ct.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                        <span>{staff ? teacherLabel(staff) : ct.teacher_profile_id} <span className="text-xs text-muted-foreground">({ct.role})</span></span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-red-600"
                                            disabled={busyId === ct.teacher_profile_id}
                                            onClick={() => handleRemove(ct.teacher_profile_id)}
                                        >
                                            {busyId === ct.teacher_profile_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search teachers by name"
                        className="ps-9"
                        autoComplete="off"
                    />
                    {searching && (
                        <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                    {results.length === 0 && !searching ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">No teachers found</p>
                    ) : (
                        results
                            .filter((s) => !assignedProfileIds.has(s.profile_id))
                            .map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleAssign(s.profile_id)}
                                    disabled={busyId === s.profile_id}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start hover:bg-accent disabled:opacity-60"
                                >
                                    <span>{teacherLabel(s)}</span>
                                    {busyId === s.profile_id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                    ) : (
                                        <UserPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    )}
                                </button>
                            ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
