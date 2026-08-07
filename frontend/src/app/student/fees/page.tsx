'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * This page is a duplicate of the canonical, sidebar-linked student fees page
 * at /student/billing/fees. It was unreachable from any nav/tour and referenced
 * non-existent fields (services_amount/discount_amount), so it now simply
 * redirects to the correct page instead of duplicating a broken implementation.
 */
export default function StudentFeesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/student/billing/fees')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
