/**
 * Plugins a school can switch on that exist on the website only: the app drops them from every menu.
 * Jahbadh Lab (2026-11-27): shown on the web, from https://lab.istudent.ly, not in the app.
 */
const WEB_ONLY_PLUGINS: readonly string[] = ['jahbadh_lab'];

export const appPlugins = (ids: string[]): string[] => ids.filter((id) => !WEB_ONLY_PLUGINS.includes(id));
