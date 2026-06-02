import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool } from '@/lib/api/public-pages'
import { MapPin, Phone, Globe, Mail, User2, Hash, Building2 } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  const name = res.data?.school?.name ?? 'School'
  return { title: `${name} — Public Pages` }
}

export default async function PublicSchoolPage({ params }: Props) {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)

  if (!res.success || !res.data) {
    if (res.error === 'School not found') notFound()
    // Not enabled — show a simple not-available message
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Public pages are not available for this school.
      </div>
    )
  }

  const { school, config } = res.data

  // If default page is not 'school' redirect to it
  if (config.default_page && config.default_page !== 'school' && config.default_page !== 'login') {
    redirect(`/p/${schoolSlug}/${config.default_page}`)
  }

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 text-[#57A3CC] flex-shrink-0" />
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PublicNav
        slug={schoolSlug}
        school={school}
        enabledPages={config.pages}
        customPageTitle={config.custom_page_title}
      />

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* School header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
          {school.logo_url ? (
            <Image
              src={school.logo_url}
              alt={`${school.name} logo`}
              width={96}
              height={96}
              className="rounded-xl object-contain border border-gray-200 dark:border-gray-700 bg-white p-1"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-linear-to-br from-[#57A3CC] to-[#022172] text-white">
              <Building2 className="h-12 w-12" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-[#022172] dark:text-white">{school.name}</h1>
            {school.short_name && <p className="text-gray-500 mt-1">{school.short_name}</p>}
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InfoRow icon={User2} label="Principal" value={school.principal_name} />
          <InfoRow icon={Hash} label="School Code" value={school.school_number} />
          <InfoRow
            icon={MapPin}
            label="Address"
            value={[school.address, school.city, school.state, school.zip_code].filter(Boolean).join(', ')}
          />
          <InfoRow icon={Phone} label="Phone" value={school.phone} />
          <InfoRow icon={Globe} label="Website" value={school.website} />
        </div>

        {/* Quick links */}
        {config.pages.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Links</h2>
            <div className="flex flex-wrap gap-2">
              {config.pages.filter(p => p !== 'school').map(pageId => (
                <Link
                  key={pageId}
                  href={`/p/${schoolSlug}/${pageId}`}
                  className="px-4 py-2 bg-[#022172] text-white text-sm rounded-lg hover:bg-[#022172]/90 transition-colors capitalize"
                >
                  {pageId.replace('-', ' ')}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
