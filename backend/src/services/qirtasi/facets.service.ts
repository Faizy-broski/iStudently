import { supabase } from '../../config/supabase';

class QirtasiFacetsService {
  /** Returns every facet with its values nested, ordered for direct UI rendering. */
  async listFacets(): Promise<any[]> {
    const { data: facets, error: facetsErr } = await supabase
      .from('qirtasi_facets')
      .select('*')
      .order('sort_order', { ascending: true });
    if (facetsErr) throw facetsErr;

    const { data: values, error: valuesErr } = await supabase
      .from('qirtasi_facet_values')
      .select('*')
      .order('sort_order', { ascending: true });
    if (valuesErr) throw valuesErr;

    const valuesByFacet = new Map<string, any[]>();
    for (const v of values ?? []) {
      const list = valuesByFacet.get(v.facet_id) ?? [];
      list.push(v);
      valuesByFacet.set(v.facet_id, list);
    }

    return (facets ?? []).map((f) => ({ ...f, values: valuesByFacet.get(f.id) ?? [] }));
  }
}

export const qirtasiFacetsService = new QirtasiFacetsService();
