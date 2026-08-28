'use client'

import { ThreadList } from '@/components/fina/ThreadList'

export default function TeacherFinaThreadsPage() {
  return <ThreadList role="teacher" basePath="/teacher/fina/threads" />
}
