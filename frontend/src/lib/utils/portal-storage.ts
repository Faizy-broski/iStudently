// Portal Storage Utilities
// Tracks viewed notes and polls in localStorage for notification badge management
// Keys are scoped by userId to prevent cross-user contamination on shared devices

const VIEWED_NOTES_KEY = 'portal_viewed_notes'
const VIEWED_POLLS_KEY = 'portal_viewed_polls'

interface ViewedItems {
  ids: string[]
  lastUpdated: string
}

function getStorageKey(type: 'note' | 'poll', userId?: string): string {
  const base = type === 'note' ? VIEWED_NOTES_KEY : VIEWED_POLLS_KEY
  return userId ? `${base}_${userId}` : base
}

export function getViewedPortalItems(type: 'note' | 'poll', userId?: string): string[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(getStorageKey(type, userId))
    if (stored) {
      const data: ViewedItems = JSON.parse(stored)
      return data.ids || []
    }
  } catch {
    // Invalid data, return empty
  }
  return []
}

export function markPortalItemViewed(type: 'note' | 'poll', id: string, userId?: string): void {
  if (typeof window === 'undefined') return

  try {
    const existing = getViewedPortalItems(type, userId)
    if (!existing.includes(id)) {
      const updated: ViewedItems = {
        ids: [...existing, id],
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(type, userId), JSON.stringify(updated))
    }
  } catch {
    // Storage full or unavailable
  }
}

export function markMultiplePortalItemsViewed(type: 'note' | 'poll', ids: string[], userId?: string): void {
  if (typeof window === 'undefined') return

  try {
    const existing = getViewedPortalItems(type, userId)
    const newIds = ids.filter(id => !existing.includes(id))

    if (newIds.length > 0) {
      const updated: ViewedItems = {
        ids: [...existing, ...newIds],
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(type, userId), JSON.stringify(updated))
    }
  } catch {
    // Storage full or unavailable
  }
}

export function getUnviewedCount(type: 'note' | 'poll', allIds: string[], userId?: string): number {
  const viewedIds = getViewedPortalItems(type, userId)
  return allIds.filter(id => !viewedIds.includes(id)).length
}

export function isPortalItemViewed(type: 'note' | 'poll', id: string, userId?: string): boolean {
  const viewedIds = getViewedPortalItems(type, userId)
  return viewedIds.includes(id)
}

export function clearViewedPortalItems(type?: 'note' | 'poll', userId?: string): void {
  if (typeof window === 'undefined') return

  if (type) {
    localStorage.removeItem(getStorageKey(type, userId))
  } else {
    localStorage.removeItem(getStorageKey('note', userId))
    localStorage.removeItem(getStorageKey('poll', userId))
  }
}

// Clean up old viewed items (keep only last 500 to prevent localStorage bloat)
export function cleanupViewedItems(userId?: string): void {
  if (typeof window === 'undefined') return

  const MAX_ITEMS = 500

  ;(['note', 'poll'] as const).forEach(type => {
    try {
      const key = getStorageKey(type, userId)
      const stored = localStorage.getItem(key)
      if (stored) {
        const data: ViewedItems = JSON.parse(stored)
        if (data.ids.length > MAX_ITEMS) {
          const trimmed: ViewedItems = {
            ids: data.ids.slice(-MAX_ITEMS),
            lastUpdated: new Date().toISOString()
          }
          localStorage.setItem(key, JSON.stringify(trimmed))
        }
      }
    } catch {
      // Invalid data, clear it
      localStorage.removeItem(getStorageKey(type, userId))
    }
  })
}
