'use client'

import { ThreadList } from '@/components/fina/ThreadList'

export default function AdminFinaThreadsPage() {
  return <ThreadList role="admin" basePath="/admin/fina/threads" />
}
