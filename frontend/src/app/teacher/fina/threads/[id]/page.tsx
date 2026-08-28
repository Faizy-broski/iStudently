'use client'

import { useParams } from 'next/navigation'
import { ThreadView } from '@/components/fina/ThreadView'

export default function TeacherFinaThreadDetailPage() {
  const params = useParams<{ id: string }>()
  return <ThreadView threadId={params.id} backHref="/teacher/fina/threads" canSend />
}
