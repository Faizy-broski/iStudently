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
import { createCircle, type HifziCircle } from '@/lib/api/hifzi'
import { getRiwayat, type QuranRiwayah } from '@/lib/api/quran'
import { toast } from 'sonner'

interface CircleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: (circle: HifziCircle) => void
    campusId?: string | null
}

export function CircleDialog({ open, onOpenChange, onCreated, campusId }: CircleDialogProps) {
    const t = useTranslations('hifzi.circles')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [riwayat, setRiwayat] = useState<QuranRiwayah[]>([])
    const [nameAr, setNameAr] = useState('')
    const [nameEn, setNameEn] = useState('')
    const [riwayahId, setRiwayahId] = useState('')
    const [sectionGender, setSectionGender] = useState<'male' | 'female' | 'mixed'>('mixed')
    const [capacity, setCapacity] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (open) {
            getRiwayat().then((res) => {
                if (res.success && res.data) {
                    setRiwayat(res.data)
                    if (!riwayahId && res.data.length > 0) setRiwayahId(res.data[0].id)
                    if (res.data.length === 0) {
                        toast.error('No riwayat found — run backend/migrations/272_seed_quran_riwayat.sql against the database.')
                    }
                } else {
                    // Was previously silent on failure, making this exact "empty dropdown" bug
                    // undiagnosable from the UI alone — now it surfaces the actual API error.
                    toast.error(res.error || 'Failed to load riwayat')
                }
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const reset = () => {
        setNameAr('')
        setNameEn('')
        setSectionGender('mixed')
        setCapacity('')
    }

    const handleSubmit = async () => {
        if (!nameAr.trim() || !riwayahId) return
        setIsSubmitting(true)
        try {
            const res = await createCircle(
                {
                    name_ar: nameAr.trim(),
                    name_en: nameEn.trim() || undefined,
                    riwayah_id: riwayahId,
                    section_gender: sectionGender,
                    capacity: capacity ? Number(capacity) : undefined,
                },
                campusId
            )
            if (res.success && res.data) {
                toast.success(t('createSuccess'))
                onCreated(res.data)
                reset()
                onOpenChange(false)
            } else {
                toast.error(res.error || t('createError'))
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { if (!v) reset(); onOpenChange(v) } }}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{t('create')}</DialogTitle>
                    <DialogDescription>{t('title')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>{t('nameAr')}</Label>
                            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('nameEn')}</Label>
                            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
                        </div>
                    </div>

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

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>{t('sectionGender')}</Label>
                            <select
                                value={sectionGender}
                                onChange={(e) => setSectionGender(e.target.value as any)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="mixed">{t('mixed')}</option>
                                <option value="male">{t('male')}</option>
                                <option value="female">{t('female')}</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('capacity')}</Label>
                            <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={1} />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 mt-4">
                    <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isSubmitting}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !nameAr.trim() || !riwayahId} className="gradient-blue text-white border-0">
                        {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                        {t('create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
