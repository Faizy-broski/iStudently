'use client'

import Link from 'next/link'
import { GraduationCap, Users, BookOpen, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

export default function AcademicsPage() {
  const t = useTranslations('school.overview')
  
  const sections = [
    {
      title: t('grades_title'),
      description: t('grades_desc'),
      icon: GraduationCap,
      href: '/admin/academics/grades',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: t('sections_title'),
      description: t('sections_desc'),
      icon: Users,
      href: '/admin/academics/sections',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: t('subjects_title'),
      description: t('subjects_desc'),
      icon: BookOpen,
      href: '/admin/academics/subjects',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${section.color}`} />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={section.href}>
                  <Button variant="outline" className="w-full group">
                    {t('manage', { title: section.title })}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-l-4 border-l-blue-600">
        <CardHeader>
          <CardTitle>{t('dependency_title')}</CardTitle>
          <CardDescription>
            {t('dependency_subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              {t('step1_title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step1_desc')}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              {t('step2_title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step2_desc')}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              {t('step3_title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step3_desc')}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-900">
              <strong>{t('important')}</strong> {t('rule')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
