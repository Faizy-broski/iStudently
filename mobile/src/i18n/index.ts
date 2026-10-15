import './intl-polyfills'

import { isRtl, SUPPORTED_LOCALES, type Locale } from '@studently/shared-utils'
import { getLocales } from 'expo-localization'
import Storage from 'expo-sqlite/kv-store'
import * as Updates from 'expo-updates'
import i18n from 'i18next'
import ICU from 'i18next-icu'
import { initReactI18next } from 'react-i18next'
import { DevSettings, I18nManager } from 'react-native'

import appAr from './app/ar.json'
import appEn from './app/en.json'
import ar from './messages/ar.json'
import en from './messages/en.json'

const LOCALE_KEY = 'app.locale'

function initialLocale(): Locale {
  const saved = Storage.getItemSync(LOCALE_KEY)
  if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) return saved as Locale
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en'
}

export const locale = initialLocale()

/** True once the user picked a language on this device (otherwise the account's language may apply). */
export function hasSavedLocale() {
  return !!Storage.getItemSync(LOCALE_KEY)
}

// Web strings use ICU syntax ({name}, {count, plural, ...}) from next-intl, so use the ICU plugin.
// Keys are namespaced by the top-level object: t('login.title') or useTranslation('login').
// Web strings come from frontend/messages (synced); app-only strings live in ./app under `app.*`.
i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    lng: locale,
    fallbackLng: 'en',
    resources: {
      en: { translation: { ...en, app: appEn } },
      ar: { translation: { ...ar, app: appAr } },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })

// Layout direction must match the language; it only applies after a reload.
const wantRtl = isRtl(locale)
I18nManager.allowRTL(true)
if (I18nManager.isRTL !== wantRtl) {
  I18nManager.forceRTL(wantRtl)
}

export async function setLocale(next: Locale) {
  Storage.setItemSync(LOCALE_KEY, next)
  await i18n.changeLanguage(next)
  if (I18nManager.isRTL !== isRtl(next)) {
    I18nManager.forceRTL(isRtl(next))
    if (__DEV__) DevSettings.reload()
    else await Updates.reloadAsync()
  }
}

export default i18n
