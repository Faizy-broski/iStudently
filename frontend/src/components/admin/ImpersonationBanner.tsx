'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { Button } from '@/components/ui/button'
import { LogOut, Shield } from 'lucide-react'

export function ImpersonationBanner() {
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const router = useRouter()
  const { mutate } = useSWRConfig()

  useEffect(() => {
    setSchoolName(sessionStorage.getItem('impersonatedSchoolName'))
  }, [])

  if (!schoolName) return null

  const exit = () => {
    mutate(() => true, undefined, { revalidate: false })
    sessionStorage.removeItem('impersonatedSchoolId')
    sessionStorage.removeItem('impersonatedSchoolName')
    router.push('/superadmin/school-directory')
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <Shield className="h-4 w-4 text-amber-600" />
        <span>
          Super Admin — Managing: <strong>{schoolName}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={exit}
        className="border-amber-300 text-amber-800 hover:bg-amber-100 gap-1.5"
      >
        <LogOut className="h-3.5 w-3.5" />
        Exit to Super Admin
      </Button>
    </div>
  )
}
