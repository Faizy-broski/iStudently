/**
 * Utility for handling abortable fetch requests
 * Prevents "signal aborted without reason" errors
 */

interface AbortableRequestOptions extends RequestInit {
  timeout?: number // Timeout in milliseconds
}

// Store active controllers to clean them up
const activeControllers = new Set<AbortController>()

/**
 * Creates an abortable fetch request with automatic cleanup
 */
export async function abortableFetch(
  url: string,
  options: AbortableRequestOptions = {}
): Promise<Response> {
  const { timeout = 30000, signal: externalSignal, ...fetchOptions } = options

  // Create abort controller
  const controller = new AbortController()
  activeControllers.add(controller)

  // Handle external signal (if provided)
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort())
    }
  }

  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timeout after ${timeout}ms`))
  }, timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    return response
  } catch (error: any) {
    // Handle abort errors gracefully
    if (error.name === 'AbortError') {
      console.log('ℹ️ Request aborted:', url)
      throw new Error('Request was cancelled')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    activeControllers.delete(controller)
  }
}

/**
 * Abort all active requests (useful during navigation or logout)
 */
export function abortAllRequests(reason?: string) {
  console.log(`🛑 Aborting ${activeControllers.size} active requests`, reason ? `(${reason})` : '')
  activeControllers.forEach(controller => {
    try {
      controller.abort(reason || 'Navigation or context change')
    } catch (err) {
      // Ignore errors from already aborted controllers
    }
  })
  activeControllers.clear()
}
