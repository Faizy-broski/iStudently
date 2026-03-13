import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicMarkingPeriods, mpTypeLabel } from '@/lib/api/public-pages'
import { CalendarRange } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  return { title: `Marking Periods — ${res.data?.school?.name ?? 'School'}` }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const MP_TYPE_COLORS: Record<string, string> = {
  FY: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  SEM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  QTR: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  PRO: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

export default async function PublicMarkingPeriodsPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, periodsRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicMarkingPeriods(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const periods = periodsRes.data ?? []

  // Group by mp_type
  const grouped: Record<string, typeof periods> = {}
  for (const p of periods) {
    if (!grouped[p.mp_type]) grouped[p.mp_type] = []
    grouped[p.mp_type].push(p)
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
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <CalendarRange className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Marking Periods</h1>
        </div>

        {periods.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarRange className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No marking periods configured.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {(['FY', 'SEM', 'QTR', 'PRO'] as const).filter(t => grouped[t]).map(type => (
              <div key={type}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${MP_TYPE_COLORS[type]}`}>{type}</span>
                  {mpTypeLabel(type)}
                </h2>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Period</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Start Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">End Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {grouped[type].map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {p.title}
                            <span className="ml-2 text-xs text-gray-400">({p.short_name})</span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(p.start_date)}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(p.end_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
