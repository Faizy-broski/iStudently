import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicStaff, staffDisplayName } from '@/lib/api/public-pages'
import type { PublicStaffMember } from '@/lib/api/public-pages'
import { Users, User } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  return { title: `Staff — ${res.data?.school?.name ?? 'School'}` }
}

function StaffCard({ member }: { member: PublicStaffMember }) {
  const name = staffDisplayName(member)
  const image = member.profile?.profile_photo_url
  const roleLabel = member.role === 'admin' ? 'Administrator' : 'Teacher'

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      {image ? (
        <Image
          src={image}
          alt={name}
          width={48}
          height={48}
          className="rounded-full object-cover w-12 h-12 flex-shrink-0"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
          <User className="h-6 w-6 text-gray-400" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-sm text-[#57A3CC]">{roleLabel}</p>
      </div>
    </div>
  )
}

export default async function PublicStaffPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, staffRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicStaff(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const allStaff = staffRes.data ?? []

  const teachers = allStaff.filter(m => m.role === 'teacher')
  const admins = allStaff.filter(m => m.role === 'admin')

  const Section = ({ title, members }: { title: string; members: PublicStaffMember[] }) => {
    if (members.length === 0) return null
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {title} <span className="ml-1 text-gray-400 font-normal">({members.length})</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map(m => <StaffCard key={m.id} member={m} />)}
        </div>
      </section>
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

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <Users className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Staff Directory</h1>
        </div>

        {allStaff.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No staff members available.</p>
          </div>
        ) : (
          <>
            <Section title="Teachers" members={teachers} />
            <Section title="Administrators" members={admins} />
          </>
        )}
      </main>
    </>
  )
}
