import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicCourses } from '@/lib/api/public-pages'
import { BookOpen, Search } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const res = await getPublicSchool(schoolSlug)
  return { title: `Courses — ${res.data?.school?.name ?? 'School'}` }
}

const SUBJECT_TYPE_COLORS: Record<string, string> = {
  theory: 'bg-blue-100 text-blue-700',
  lab: 'bg-green-100 text-green-700',
  practical: 'bg-orange-100 text-orange-700',
}

export default async function PublicCoursesPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, coursesRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicCourses(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const courses = coursesRes.data ?? []

  return (
    <>
      <PublicNav
        slug={schoolSlug}
        school={school}
        enabledPages={config.pages}
        customPageTitle={config.custom_page_title}
      />

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Course Directory</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">{courses.length} course{courses.length !== 1 ? 's' : ''} available</p>

        {courses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No courses available.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Course</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Credits</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{course.title}</p>
                      {course.short_name && <p className="text-xs text-gray-400">{course.short_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {course.subject ? (
                        <span>
                          {course.subject.name}
                          <span className="ml-1 text-xs text-gray-400">({course.subject.code})</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {course.credit_hours ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {course.subject?.subject_type ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SUBJECT_TYPE_COLORS[course.subject.subject_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {course.subject.subject_type}
                        </span>
                      ) : '—'}
                    </td>
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
