// Public school site (/p/<slug>): which pages visitors see, landing page, custom page.
// Same endpoints as frontend/src/lib/api/public-pages.ts; router: public-pages.routes.ts (/public).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type PublicPageId = 'school' | 'events' | 'marking-periods' | 'courses' | 'activities' | 'staff' | 'custom'

export const PUBLIC_PAGE_IDS: PublicPageId[] = ['school', 'events', 'marking-periods', 'courses', 'activities', 'staff', 'custom']

export interface PublicPagesConfig {
  /** Activation itself is the public_pages plugin (Settings → Plugins). */
  pages: PublicPageId[]
  default_page: PublicPageId | 'login'
  custom_page_title: string
  /** HTML from the web's rich-text editor. */
  custom_page_content: string
}

export function adminPublicPagesApi(api: ApiClient) {
  return {
    settings: (campusId?: string) =>
      api.get<{ config: PublicPagesConfig; available_pages: { id: PublicPageId; label: string }[]; slug?: string | null }>(`/public/config/settings${qs({ campus_id: campusId })}`),
    save: (config: PublicPagesConfig, campusId?: string) => api.put<PublicPagesConfig>(`/public/config/settings${qs({ campus_id: campusId })}`, config),
  }
}
