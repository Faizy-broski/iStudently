import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicNav from '@/components/public/PublicNav'
import { getPublicSchool, getPublicCustomPage } from '@/lib/api/public-pages'
import { FileText } from 'lucide-react'

interface Props { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params
  const [schoolRes, customRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicCustomPage(schoolSlug),
  ])
  const schoolName = schoolRes.data?.school?.name ?? 'School'
  const pageTitle = customRes.data?.title || 'Custom Page'
  return { title: `${pageTitle} — ${schoolName}` }
}

export default async function PublicCustomPage({ params }: Props) {
  const { schoolSlug } = await params

  const [schoolRes, customRes] = await Promise.all([
    getPublicSchool(schoolSlug),
    getPublicCustomPage(schoolSlug),
  ])

  if (!schoolRes.success || !schoolRes.data) notFound()

  const { school, config } = schoolRes.data
  const custom = customRes.data

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
            <FileText className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#022172] dark:text-white">
            {custom?.title || config.custom_page_title || 'Custom Page'}
          </h1>
        </div>

        {custom?.content ? (
          <div
            className="prose prose-gray dark:prose-invert max-w-none bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
            dangerouslySetInnerHTML={{ __html: custom.content }}
          />
        ) : (
          <div className="text-center py-16 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No content available.</p>
          </div>
        )}
      </main>
    </>
  )
}
