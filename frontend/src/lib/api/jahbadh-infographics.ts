// Jahbadh grades — «إنفوجرافيك جهبذ» data (backend: GET /jahbadh-grades/sections/:id/infographics). The pages are
// rendered in the browser from this model with the shared report functions; there is no server PDF.
import type { JgInfographics } from "@studently/api-client/modules/jahbadh-insight";
import { jgRequest } from "./jahbadh-grades";

export type { JgInfographics };

const q = (params: Record<string, string | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const jgInfographicsApi = {
  /** `scope`: final | todate | stage:N | month:N:I. `compare`: the earlier period, or null. */
  get: (sectionId: string, scope = "final", compare?: string | null, campusId?: string | null) =>
    jgRequest<JgInfographics>(`/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/infographics${q({ scope, compare, campus_id: campusId })}`),
};
