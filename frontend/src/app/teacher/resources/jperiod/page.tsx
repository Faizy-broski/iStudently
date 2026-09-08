'use client'

import { useTranslations } from 'next-intl'
import { JperiodEmbed } from '@/components/resources/JperiodEmbed'

export default function TeacherJperiodPage() {
  const t = useTranslations('teacherPages.resourcesJperiod')
  return <JperiodEmbed title={t('title')} />
}
