'use client'

import { ThreadList } from '@/components/fina/ThreadList'

export default function ParentFinaThreadsPage() {
  return <ThreadList role="parent" basePath="/parent/fina/threads" />
}
