import type { ApiResponse } from '@studently/api-client'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '@/components/app/toast'

/**
 * Runs a write call with busy state and toasts.
 * `const save = useAction(api.update, { success: t('app.saved') }); const { ok, data } = await save.run(id, body)`
 * On failure an error toast was already shown and `ok` is false.
 */
export function useAction<A extends unknown[], T>(
  fn: (...args: A) => Promise<ApiResponse<T>>,
  opts: { success?: string; onSuccess?: (data: T | undefined) => void } = {},
) {
  const { t } = useTranslation()
  const toast = useToast()
  const [running, setRunning] = useState(false)

  const run = useCallback(
    async (...args: A): Promise<{ ok: boolean; data?: T }> => {
      setRunning(true)
      try {
        const res = await fn(...args)
        if (!res.success) {
          const offline = res.code === 'NETWORK_ERROR' || res.code === 'TIMEOUT'
          toast.error(offline ? t('app.offline_body') : res.error || t('app.error_title'))
          return { ok: false }
        }
        if (opts.success) toast.success(opts.success)
        opts.onSuccess?.(res.data)
        return { ok: true, data: res.data }
      } finally {
        setRunning(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, opts.success, opts.onSuccess],
  )

  return { run, running }
}
