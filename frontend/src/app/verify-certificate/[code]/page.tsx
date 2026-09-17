'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react'
import { publicTrainingApi } from '@/lib/api/training'

interface VerifyResult {
  valid: boolean
  recipient_name?: string
  session_title?: string
  issued_at?: string
}

export default function VerifyCertificatePage() {
  const params = useParams()
  const code = params.code as string

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<VerifyResult | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    publicTrainingApi
      .verifyCertificate(code)
      .then((res) => { if (!cancelled) setResult(res) })
      .catch(() => { if (!cancelled) setResult({ valid: false }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#022172]/5 to-white dark:from-[#022172]/20 dark:to-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <ShieldCheck className="h-10 w-10 text-[#022172] dark:text-[#57A3CC]" />
          <h1 className="text-xl font-bold text-[#022172] dark:text-white mt-2">Certificate Verification</h1>
        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6">
          {loading ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verifying certificate…</p>
            </div>
          ) : result?.valid ? (
            <div className="flex flex-col items-center py-4 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Valid Certificate</p>
              <div className="w-full mt-2 space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-semibold">{result.recipient_name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Session</span>
                  <span className="font-semibold text-right">{result.session_title}</span>
                </div>
                {result.issued_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Issued</span>
                    <span className="font-semibold">{format(new Date(result.issued_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">Certificate Not Found</p>
              <p className="text-sm text-muted-foreground">
                This verification code doesn't match any issued certificate on record.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
