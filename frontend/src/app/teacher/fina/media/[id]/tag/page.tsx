'use client'

import { useParams } from 'next/navigation'
import { MediaTaggingScreen } from '@/components/fina/MediaTaggingScreen'

export default function TeacherFinaMediaTagPage() {
  const params = useParams<{ id: string }>()
  return <MediaTaggingScreen mediaId={params.id} backHref="/teacher/fina/media" />
}
