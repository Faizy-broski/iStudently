/**
 * Simple fetch wrapper with timeout
 * NO AbortController - requests complete naturally
 * Silent error handling - never throws
 */

interface FetchOptions extends RequestInit {
  timeout?: number
}

/**
 * Production-ready fetch with timeout (no AbortController)
 * Uses Promise.race() for timeout instead of abort signals
 */
export async function simpleFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options

  // Create a timeout promise that rejects after the specified time
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('TIMEOUT'))
    }, timeout)
  })

  // Race between fetch and timeout
  const response = await Promise.race([
    fetch(url, fetchOptions),
    timeoutPromise
  ])

  return response
}

/**
 * @deprecated Use simpleFetch instead - this is kept for backward compatibility
 * Will be removed in future versions
 */
export async function abortableFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  return simpleFetch(url, options)
}

/**
 * @deprecated No longer needed - kept for backward compatibility
 */
export function abortAllRequests(_reason?: string) {
  // No-op - requests complete naturally now
}
