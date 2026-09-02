'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Mic, CalendarCheck, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getCircles, type HifziCircle } from '@/lib/api/hifzi'

// Fixes a real dead link: frontend/src/config/sidebar.ts's teacher nav group
// already points its parent item at /teacher/hifzi — this page didn't exist
// yet, so it 404'd. Pattern-matched against admin/hifzi/page.tsx (gradient
// header, one stat card, nav-link card grid), scaled to teacher-only links
// (no circles/students/settings admin links). getCircles() here is
// unscoped, same as the sibling attendance/plans pages already are — no
// per-teacher circle filter exists yet (see hifzi-access.ts's
// isTeacherAssignedToCircle for the building block a future `?my=true`
// filter on GET /hifzi/circles could use) — the stat card is labeled plain
// "Circles", not "My Circles", to not imply scoping it doesn't have.
export default function TeacherHifziOverviewPage() {
    const t = useTranslations('hifzi')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const [circles, setCircles] = useState<HifziCircle[]>([])

    useEffect(() => {
        getCircles().then((res) => { if (res.success && res.data) setCircles(res.data) })
    }, [])

    const links = [
        { href: '/teacher/hifzi/recite', icon: Mic, label: t('recitation.title') },
        { href: '/teacher/hifzi/attendance', icon: CalendarCheck, label: t('attendance.title') },
        { href: '/teacher/hifzi/plans', icon: Calendar, label: t('plans.title') },
    ]

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('overview.title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t('overview.subtitle')}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-[#57A3CC] to-[#022172] text-white">
                    <CardContent className="p-4">
                        <div className="text-3xl font-bold">{circles.length}</div>
                        <p className="text-white/80 text-xs mt-1">{t('circles.title')}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {links.map((link) => (
                    <Link key={link.href} href={link.href}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                            <CardContent className="p-6 flex flex-col items-center gap-2 text-center">
                                <div className="h-10 w-10 rounded-lg gradient-blue flex items-center justify-center">
                                    <link.icon className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-sm font-medium">{link.label}</span>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
