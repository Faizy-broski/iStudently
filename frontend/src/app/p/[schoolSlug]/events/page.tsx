import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicEvents, formatEventDate } from '@/lib/api/public-pages'
import { Calendar, Tag } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  return { title: `Events — ${res.data?.school?.name ?? 'School'}` }
}

const CATEGORY_COLORS: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-800',
  holiday: 'bg-green-100 text-green-800',
  exam: 'bg-red-100 text-red-800',
  meeting: 'bg-purple-100 text-purple-800',
  activity: 'bg-orange-100 text-orange-800',
  reminder: 'bg-yellow-100 text-yellow-800',
}

export default async function PublicEventsPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, eventsRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicEvents(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const events = eventsRes.data ?? []

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
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Events</h1>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No upcoming events in the next 90 days.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex gap-4"
              >
                {/* Color indicator */}
                <div
                  className="w-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color_code || '#022172' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[event.category] ?? 'bg-gray-100 text-gray-700'}`}>
                      <Tag className="h-3 w-3" />
                      {event.category}
                    </span>
                  </div>
                  <p className="text-sm text-[#57A3CC] mt-1">
                    {formatEventDate(event.start_at, event.end_at, event.is_all_day)}
                  </p>
                  {event.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
