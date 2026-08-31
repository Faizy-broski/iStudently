'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { SignupLinkForm } from '@/components/admin/signup-links/SignupLinkForm'
import { getSignupLink, type SignupLink } from '@/lib/api/signup-links'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

export default function EditSignupLinkPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const [link, setLink] = useState<SignupLink | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getSignupLink(id).then((res) => {
      if (!active) return
      if (res.success && res.data) {
        setLink(res.data)
      } else {
        toast.error(res.error || (isAr ? 'تعذر تحميل الرابط' : 'Could not load this signup link'))
        router.push('/admin/signup-links')
      }
      setLoading(false)
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading || !link) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  // Mounted only once `link` is populated, so SignupLinkForm's useState
  // initializers can read `initial` synchronously on first render instead
  // of needing a reconciliation effect for the basic fields too.
  return <SignupLinkForm mode="edit" initial={link} />
}
