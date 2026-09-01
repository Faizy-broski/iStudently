'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { BookOpen, Users, Settings, CalendarCheck, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getCircles, type HifziCircle } from '@/lib/api/hifzi'
import { useCampus } from '@/context/CampusContext'

export default function HifziOverviewPage() {
    const t = useTranslations('hifzi')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id
    const [circles, setCircles] = useState<HifziCircle[]>([])

    useEffect(() => {
        getCircles(campusId).then((res) => { if (res.success && res.data) setCircles(res.data) })
    }, [campusId])

    const totalStudents = circles.reduce((sum, c) => sum + (c.hifzi_circle_teachers?.length ?? 0), 0)

    const links = [
        { href: '/admin/hifzi/circles', icon: BookOpen, label: t('circles.title') },
        { href: '/admin/hifzi/students', icon: Users, label: t('students.title') },
        { href: '/admin/hifzi/attendance', icon: CalendarCheck, label: t('attendance.title') },
        { href: '/admin/hifzi/reports', icon: BarChart3, label: t('reports.title') },
        { href: '/admin/hifzi/settings', icon: Settings, label: t('settings.title') },
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
