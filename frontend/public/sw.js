// Web Push service worker.
// Kept as a plain static file (not bundled) so it can be registered at the
// root scope ("/") and intercept push events for the whole origin.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Studently', body: event.data.text() }
  }

  const title = payload.title || 'Studently'
  const options = {
    body: payload.body || '',
    // TODO: swap for a dedicated 192x192 notification icon once designed — logo.png works but isn't optimized for this.
    icon: payload.icon || '/images/logo.png',
    badge: '/images/logo.png',
    tag: payload.tag,
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url)
        if (clientUrl.pathname === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
