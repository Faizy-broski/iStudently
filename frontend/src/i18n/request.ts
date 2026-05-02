import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const rawLocale = cookieStore.get('studently_language')?.value
  const locale = rawLocale === 'ar' ? 'ar' : 'en'

  const messages =
    locale === 'ar'
      ? (await import('../../messages/ar.json')).default
      : (await import('../../messages/en.json')).default

  return { locale, messages }
})
