import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicActivities } from '@/lib/api/public-pages'
import { Trophy } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  return { title: `Activities — ${res.data?.school?.name ?? 'School'}` }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function PublicActivitiesPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, activitiesRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicActivities(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const activities = activitiesRes.data ?? []

  return (
    <>
      <PublicNav
        slug={schoolSlug}
        school={school}
        enabledPages={config.pages}
        customPageTitle={config.custom_page_title}
      />

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Activities</h1>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No activities available.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Activity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Begin</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">End</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {activities.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{act.title}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatDate(act.start_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatDate(act.end_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{act.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
