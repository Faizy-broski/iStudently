'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { createPlan, updatePlan, type CreatePlanDTO } from '@/lib/api/hifzi'
import { getRiwayat, type QuranRiwayah } from '@/lib/api/quran'
import { toast } from 'sonner'

interface EditablePlan {
    id: string
    plan_type: string
    riwayah_id: string
    daily_new_ayat_target: number | null
}

interface CreatePlanDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    circleId?: string | null
    campusId?: string | null
    /** When set, the dialog edits this plan (PATCH) instead of creating a new one (POST). */
    editingPlan?: EditablePlan | null
    onCreated: () => void
}

const PLAN_TYPES: CreatePlanDTO['plan_type'][] = ['quantity_based', 'time_based', 'staged', 'custom', 'intensive']

/**
 * Minimal plan create/edit dialog — deliberately no ayah-range picker.
 * quran_ayahs (the actual Quran text corpus) is intentionally unseeded
 * pending a licensing decision (see migrations/272_seed_quran_riwayat.sql's
 * own comment), so target_start_ayah_id/target_end_ayah_id are left null
 * here. This just registers the student's riwayah + pace; the assignment
 * builder (plans.service.ts::generateDailyAssignmentForStudent) will have
 * something to build ayah-range assignments from once that corpus lands.
 */
export function CreatePlanDialog({ open, onOpenChange, studentId, circleId, campusId, editingPlan, onCreated }: CreatePlanDialogProps) {
    const t = useTranslations('hifzi.plans')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const isEditing = !!editingPlan

    const [riwayat, setRiwayat] = useState<QuranRiwayah[]>([])
    const [riwayahId, setRiwayahId] = useState('')
    const [planType, setPlanType] = useState<CreatePlanDTO['plan_type']>('quantity_based')
    const [dailyTarget, setDailyTarget] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!open) return
        if (editingPlan) {
            setRiwayahId(editingPlan.riwayah_id)
            setPlanType(editingPlan.plan_type as CreatePlanDTO['plan_type'])
            setDailyTarget(editingPlan.daily_new_ayat_target != null ? String(editingPlan.daily_new_ayat_target) : '')
        } else {
            setPlanType('quantity_based')
            setDailyTarget('')
        }
        getRiwayat().then((res) => {
            if (res.success && res.data) {
                setRiwayat(res.data)
                if (!editingPlan && res.data.length > 0) setRiwayahId((prev) => prev || res.data![0].id)
            } else {
                toast.error(res.error || 'Failed to load riwayat')
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingPlan?.id])

    const handleSubmit = async () => {
        if (!riwayahId) return
        setIsSubmitting(true)
        try {
            const dto: CreatePlanDTO = {
                student_id: studentId,
                circle_id: circleId ?? undefined,
                plan_type: planType,
                riwayah_id: riwayahId,
                daily_new_ayat_target: dailyTarget ? Number(dailyTarget) : undefined,
            }
            const res = isEditing ? await updatePlan(editingPlan!.id, dto, campusId) : await createPlan(dto, campusId)
            if (res.success) {
                toast.success(isEditing ? t('updateSuccess') : t('createSuccess'))
                onCreated()
                onOpenChange(false)
            } else {
                toast.error(res.error || (isEditing ? t('updateError') : t('createError')))
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? t('edit') : t('create')}</DialogTitle>
                    <DialogDescription>{t('corpusNote')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="space-y-2">
                        <Label>{t('riwayah')}</Label>
                        <select
                            value={riwayahId}
                            onChange={(e) => setRiwayahId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {riwayat.map((r) => (
                                <option key={r.id} value={r.id}>{isAr ? r.name_ar : r.name_en}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('planType')}</Label>
                        <select
                            value={planType}
                            onChange={(e) => setPlanType(e.target.value as CreatePlanDTO['plan_type'])}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {PLAN_TYPES.map((pt) => (
                                <option key={pt} value={pt}>{t(`planType_${pt}` as any)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('dailyTarget')}</Label>
                        <Input type="number" min={1} value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} />
                    </div>
                </div>

                <DialogFooter className="gap-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !riwayahId} className="gradient-blue text-white border-0">
                        {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                        {isEditing ? t('edit') : t('create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
