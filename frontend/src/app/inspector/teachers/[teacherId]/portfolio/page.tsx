'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, GraduationCap, Award, Languages, Sparkles, FileText, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTeacherPortfolio, type TeacherPortfolio } from '@/lib/api/inspector-teachers'

export default function TeacherPortfolioPage() {
  const t = useTranslations('inspections.portfolio')
  const params = useParams()
  const teacherId = params?.teacherId as string

  const [portfolio, setPortfolio] = useState<TeacherPortfolio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teacherId) return
    setLoading(true)
    getTeacherPortfolio(teacherId).then((res) => {
      if (res.error) toast.error(res.error)
      setPortfolio(res.data)
      setLoading(false)
    })
  }, [teacherId])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!portfolio) {
    return <div className="p-6 text-center text-gray-500">{t('not_found')}</div>
  }

  const { teacher, qualifications, historical_reports } = portfolio

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link href="/inspector/visits" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{teacher.first_name} {teacher.last_name}</CardTitle>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Building2 className="h-3.5 w-3.5" />
            {teacher.school?.name || teacher.school_id}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-[#022172]" />
            {t('education_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.education.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t('no_data')}</p>
          ) : (
            <ul className="space-y-2">
              {qualifications.education.map((e) => (
                <li key={e.id} className="text-sm">
                  <span className="font-medium text-gray-900">{e.qualification}</span>
                  {e.institute && <span className="text-gray-500"> — {e.institute}</span>}
                  {e.completed_on && <span className="text-gray-400 text-xs"> ({e.completed_on})</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5 text-[#022172]" />
            {t('certifications_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.certifications.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t('no_data')}</p>
          ) : (
            <ul className="space-y-2">
              {qualifications.certifications.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium text-gray-900">{c.title}</span>
                  {c.institute && <span className="text-gray-500"> — {c.institute}</span>}
                  {c.valid_through && <span className="text-gray-400 text-xs"> ({t('valid_through')} {c.valid_through})</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="h-5 w-5 text-[#022172]" />
            {t('languages_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.languages.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t('no_data')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {qualifications.languages.map((l) => (
                <Badge key={l.id} variant="outline">{l.title}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-[#022172]" />
            {t('skills_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.skills.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t('no_data')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {qualifications.skills.map((s) => (
                <Badge key={s.id} variant="outline">{s.title}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-[#022172]" />
            {t('historical_reports_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 py-2">
            {historical_reports.length === 0 ? t('no_historical_reports') : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
