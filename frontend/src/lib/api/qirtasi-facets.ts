import { apiRequest, type ApiResponse } from "./index";

export interface FacetValue {
  id: string;
  facet_id: string;
  value_key: string;
  label_ar: string;
  label_en: string | null;
  sort_order: number;
}

export interface Facet {
  id: string;
  key: string;
  name_ar: string;
  name_en: string | null;
  facet_group: "core" | "curriculum" | "pedagogical" | "practical";
  value_type: "enum" | "int" | "bool" | "reference";
  is_required: boolean;
  is_filterable: boolean;
  sort_order: number;
  values: FacetValue[];
}

// campus_id is required so an admin's request checks the right
// active_plugins row — see qirtasi-curriculum.ts's withCampus() comment.
export function listFacets(campusId?: string): Promise<ApiResponse<Facet[]>> {
  const suffix = campusId ? `?campus_id=${campusId}` : "";
  return apiRequest<Facet[]>(`/qirtasi/facets${suffix}`);
}
