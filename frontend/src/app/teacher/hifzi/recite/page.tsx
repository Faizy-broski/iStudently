'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Users, ChevronRight } from 'lucide-react'
import { getCircles, type HifziCircle } from '@/lib/api/hifzi'
import { toast } from 'sonner'

export default function TeacherHifziCirclePickerPage() {
    const t = useTranslations('hifzi')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const router = useRouter()
    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCircles().then((res) => {
            if (res.success && res.data) setCircles(res.data)
            else if (!res.success) toast.error(`Failed to load circles: ${res.error || 'unknown error'}`)
            setLoading(false)
        })
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
            </div>
        )
    }

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                {t('recitation.title')}
            </h1>

            {circles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('circles.noCircles')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {circles.map((circle) => (
                        <Card
                            key={circle.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => router.push(`/teacher/hifzi/recite/${circle.id}`)}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg gradient-blue flex items-center justify-center">
                                        <Users className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="font-medium">{circle.name_ar}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
