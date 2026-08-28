'use client'

import { useParams } from 'next/navigation'
import { ThreadView } from '@/components/fina/ThreadView'

export default function ParentFinaThreadDetailPage() {
  const params = useParams<{ id: string }>()
  return <ThreadView threadId={params.id} backHref="/parent/fina/threads" canSend />
}
