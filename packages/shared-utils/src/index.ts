export type Locale = 'en' | 'ar'

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar']

export function isRtl(locale: string): boolean {
  return locale.startsWith('ar')
}
