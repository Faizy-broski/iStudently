// Portal Storage Utilities
// Tracks viewed notes and polls in localStorage for notification badge management

const VIEWED_NOTES_KEY = 'portal_viewed_notes'
const VIEWED_POLLS_KEY = 'portal_viewed_polls'

interface ViewedItems {
  ids: string[]
  lastUpdated: string
}

function getStorageKey(type: 'note' | 'poll'): string {
  return type === 'note' ? VIEWED_NOTES_KEY : VIEWED_POLLS_KEY
}

export function getViewedPortalItems(type: 'note' | 'poll'): string[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(getStorageKey(type))
    if (stored) {
      const data: ViewedItems = JSON.parse(stored)
      return data.ids || []
    }
  } catch {
    // Invalid data, return empty
  }
  return []
}

export function markPortalItemViewed(type: 'note' | 'poll', id: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const existing = getViewedPortalItems(type)
    if (!existing.includes(id)) {
      const updated: ViewedItems = {
        ids: [...existing, id],
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(type), JSON.stringify(updated))
    }
  } catch {
    // Storage full or unavailable
  }
}

export function markMultiplePortalItemsViewed(type: 'note' | 'poll', ids: string[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const existing = getViewedPortalItems(type)
    const newIds = ids.filter(id => !existing.includes(id))
    
    if (newIds.length > 0) {
      const updated: ViewedItems = {
        ids: [...existing, ...newIds],
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(type), JSON.stringify(updated))
    }
  } catch {
    // Storage full or unavailable
  }
}

export function getUnviewedCount(type: 'note' | 'poll', allIds: string[]): number {
  const viewedIds = getViewedPortalItems(type)
  return allIds.filter(id => !viewedIds.includes(id)).length
}

export function isPortalItemViewed(type: 'note' | 'poll', id: string): boolean {
  const viewedIds = getViewedPortalItems(type)
  return viewedIds.includes(id)
}

export function clearViewedPortalItems(type?: 'note' | 'poll'): void {
  if (typeof window === 'undefined') return
  
  if (type) {
    localStorage.removeItem(getStorageKey(type))
  } else {
    localStorage.removeItem(VIEWED_NOTES_KEY)
    localStorage.removeItem(VIEWED_POLLS_KEY)
  }
}

// Clean up old viewed items (keep only last 500 to prevent localStorage bloat)
export function cleanupViewedItems(): void {
  if (typeof window === 'undefined') return
  
  const MAX_ITEMS = 500
  
  ;(['note', 'poll'] as const).forEach(type => {
    try {
      const stored = localStorage.getItem(getStorageKey(type))
      if (stored) {
        const data: ViewedItems = JSON.parse(stored)
        if (data.ids.length > MAX_ITEMS) {
          const trimmed: ViewedItems = {
            ids: data.ids.slice(-MAX_ITEMS),
            lastUpdated: new Date().toISOString()
          }
          localStorage.setItem(getStorageKey(type), JSON.stringify(trimmed))
        }
      }
    } catch {
      // Invalid data, clear it
      localStorage.removeItem(getStorageKey(type))
    }
  })
}
