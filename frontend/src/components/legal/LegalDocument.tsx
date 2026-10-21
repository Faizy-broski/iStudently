import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

type Doc = 'privacy' | 'terms' | 'deleteAccount'

/** Public legal page (privacy policy, terms, account deletion): linked from the app and the store listings. */
export async function LegalDocument({ doc }: { doc: Doc }) {
  const t = await getTranslations(`legal.${doc}`)
  const common = await getTranslations('legal')
  const locale = await getLocale()
  const count = Number(t('count'))
  return (
    <main dir={locale === 'ar' ? 'rtl' : 'ltr'} className="bg-background min-h-screen">
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-primary">{t('title')}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{common('updated')}</p>
        <p className="mt-6 leading-7">{t('intro')}</p>
        {Array.from({ length: count }, (_, i) => (
          <section key={i} className="mt-8">
            <h2 className="text-xl font-semibold">{t(`s${i + 1}_title`)}</h2>
            <p className="mt-2 leading-7">{t(`s${i + 1}_body`)}</p>
          </section>
        ))}
        <p className="mt-12 text-sm">
          <Link href="/auth/login" className="text-primary underline">
            {common('back')}
          </Link>
        </p>
      </article>
    </main>
  )
}

export async function legalMetadata(doc: Doc) {
  const t = await getTranslations(`legal.${doc}`)
  return { title: t('title') }
}
