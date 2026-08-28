'use client'

import { useParams } from 'next/navigation'
import { ThreadView } from '@/components/fina/ThreadView'

export default function AdminFinaThreadDetailPage() {
  const params = useParams<{ id: string }>()
  return <ThreadView threadId={params.id} backHref="/admin/fina/threads" canSend={false} />
}
