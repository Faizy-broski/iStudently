'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StaffAbsencesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/staff-absences/absences')
  }, [router])
  return null
}
