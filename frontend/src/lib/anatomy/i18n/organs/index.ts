// Locale registry for organ/hotspot content, ported from thebuggeddev/anatomy's
// 12-language dictionary set (app/i18n/organs/*.ts, copied verbatim into this
// folder). studently's own locale system (frontend/src/actions/locale.ts,
// messages/{en,ar}.json) only routes `'en' | 'ar'` today — there's no
// site-wide switcher for the other 10 — so this module only *actively serves*
// `en`/`ar` via `getOrganDictionary()`. The other 10 languages' content isn't
// discarded: it's all still here, registered below, ready to switch on the
// day studently's locale system itself grows beyond en/ar.
import type { OrganContentDictionary } from "../types";
import { organs as ar } from "./ar";
import { organs as de } from "./de";
import { organs as en } from "./en";
import { organs as es } from "./es";
import { organs as fr } from "./fr";
import { organs as hi } from "./hi";
import { organs as id } from "./id";
import { organs as ja } from "./ja";
import { organs as ko } from "./ko";
import { organs as pt } from "./pt";
import { organs as ru } from "./ru";
import { organs as zh } from "./zh";

export const organDictionariesByLocale: Record<string, OrganContentDictionary> = {
  ar, de, en, es, fr, hi, id, ja, ko, pt, ru, zh,
};

/** studently's active locales today — everything else in the registry above
 *  is ported content on standby, not yet reachable through the app's UI. */
export const SUPPORTED_ANATOMY_LOCALES = ["en", "ar"] as const;

export function getOrganDictionary(locale: string): OrganContentDictionary {
  return organDictionariesByLocale[locale] ?? en;
}
