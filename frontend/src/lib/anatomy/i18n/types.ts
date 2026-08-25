// Adapted from thebuggeddev/anatomy (app/i18n/types.ts) for the
// "anatomy_label" quiz question type. `UiDictionary`/`Dictionary` (the full
// app-shell chrome strings — nav, library, compare, quiz-round, modal, etc.)
// were dropped: they belonged to the standalone explorer (AnatomyApp.tsx),
// which studently isn't porting. Only the organ/hotspot content types survive
// — the ones the exam-builder's own picker/viewer wrapper actually needs.
import type { OrganId } from "../anatomy-data";

/** Prose for one organ. Structure (positions, colours, model) lives in
 *  `anatomy-data.ts`; only translatable text belongs here. */
export type OrganContent = {
  name: string;
  system: string;
  description: string;
  poetic: string;
  size: string;
  weight: string;
  location: string;
  function: string;
  dailyFact: string;
  medical: string;
  bloodSupply: string;
  funFact: string;
  tissue: string;
  comparison: string;
  conditions: string[];
  /** Keyed by hotspot id — the Terminologia Anatomica term is the anchor. */
  hotspots: Record<string, { label: string; detail: string }>;
};

export type OrganContentDictionary = Record<OrganId, OrganContent>;

/** Minimal `{name}` interpolation — the copy has no plurals or dates. */
export function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
