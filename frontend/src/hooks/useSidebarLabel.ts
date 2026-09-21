import { useMessages, useTranslations } from 'next-intl'

/**
 * Translates a sidebar title key the same way the sidebar itself does: known keys go
 * through the `sidebar` namespace, unknown ones fall back to a readable version of the key.
 */
export function useSidebarLabel(): (key: string) => string {
  const t = useTranslations('sidebar')
  const messages = useMessages()
  const sidebarMessages = (messages?.sidebar ?? {}) as Record<string, string>
  return (key: string) => {
    if (key === '__root__') return key in sidebarMessages ? t(key as never) : 'General'
    return key in sidebarMessages ? t(key as never) : key.replace(/_/g, ' ')
  }
}
