'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getParentChildren } from '@/lib/api/parents'
import { getHeatmap, getSessions, openReportCard, type HeatmapCell, type HifziSession } from '@/lib/api/hifzi'
import { MushafHeatmap } from '@/components/hifzi/MushafHeatmap'
import { toast } from 'sonner'

export default function ParentHifziPage() {
    const t = useTranslations('hifzi')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const { profile } = useAuth()
    const parentId = profile?.parent_id

    const [children, setChildren] = useState<{ id: string; first_name: string; last_name: string }[]>([])
    const [selectedChildId, setSelectedChildId] = useState('')
    const [cells, setCells] = useState<HeatmapCell[]>([])
    const [sessions, setSessions] = useState<HifziSession[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        if (!parentId) return
        getParentChildren(parentId).then((res) => {
            if (res.success && res.data) {
                const list = res.data.map((c: any) => ({ id: c.id, first_name: c.first_name ?? c.profile?.first_name, last_name: c.last_name ?? c.profile?.last_name }))
                setChildren(list)
                if (list.length > 0) setSelectedChildId(list[0].id)
            }
            setLoading(false)
        })
    }, [parentId])

    useEffect(() => {
        if (!selectedChildId) return
        setLoading(true)
        Promise.all([getHeatmap(selectedChildId), getSessions(selectedChildId, 10)]).then(([heatmapRes, sessionsRes]) => {
            if (heatmapRes.success && heatmapRes.data) setCells(heatmapRes.data)
            if (sessionsRes.success && sessionsRes.data) setSessions(sessionsRes.data)
            setLoading(false)
        })
    }, [selectedChildId])

    const handleDownload = async () => {
        if (!selectedChildId) return
        setGenerating(true)
        const res = await openReportCard(selectedChildId)
        if (!res.success) toast.error(res.error || t('reports.generateError'))
        setGenerating(false)
    }

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('heatmap.title')}
                </h1>
                <div className="flex items-center gap-2">
                    {children.length > 1 && (
                        <select
                            value={selectedChildId}
                            onChange={(e) => setSelectedChildId(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {children.map((c) => (
                                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                            ))}
                        </select>
                    )}
                    <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating || !selectedChildId}>
                        {generating ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Download className="h-4 w-4 me-2" />}
                        {t('reports.downloadPdf')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
                </div>
            ) : (
                <>
                    <Card>
                        <CardContent className="p-5">
                            <MushafHeatmap cells={cells} />
                        </CardContent>
                    </Card>

                    <div>
                        <h2 className="text-lg font-semibold mb-3">{t('recitation.title')}</h2>
                        <div className="space-y-2">
                            {sessions.map((s) => (
                                <Card key={s.id}>
                                    <CardContent className="p-3 flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString(isAr ? 'ar' : 'en')}</span>
                                        <Badge variant="secondary">{s.grade_code ?? '—'}</Badge>
                                        <span className="font-medium">{s.raw_score?.toFixed(2) ?? '—'}</span>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
