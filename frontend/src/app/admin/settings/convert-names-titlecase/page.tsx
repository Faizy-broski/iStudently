'use client'

import { useState } from 'react'
import { convertNamesTitlecase } from '@/lib/api/school-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Info, Type, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const EXAMPLE_ROWS = [
  { before: 'JOHN DOE',      after: 'John Doe' },
  { before: 'jane smith',    after: 'Jane Smith' },
  { before: 'AHMED al-RAZI', after: 'Ahmed Al-razi' },
  { before: 'Maria GARCIA',  after: 'Maria Garcia' },
]

export default function ConvertNamesTitlecasePage() {
  const [converting, setConverting] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const handleConvert = async () => {
    setConverting(true)
    setResult(null)
    try {
      const res = await convertNamesTitlecase()
      if (res.success && res.data != null) {
        setResult(res.data.converted)
        if (res.data.converted > 0) {
          toast.success(`${res.data.converted} profile${res.data.converted !== 1 ? 's' : ''} converted to titlecase`)
        } else {
          toast.info('All names are already in titlecase — nothing to convert')
        }
      } else {
        toast.error(res.error || 'Conversion failed')
      }
    } catch {
      toast.error('Conversion failed')
    }
    setConverting(false)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <Type className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Convert Names To Titlecase
          </h1>
          <p className="text-muted-foreground">
            Standardize student and staff names for this campus
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            Converts <strong>First Name</strong>, <strong>Last Name</strong>,{' '}
            <strong>Father Name</strong>, and <strong>Grandfather Name</strong> for every
            profile in this campus so that the first letter of each word is uppercase and
            the rest are lowercase — matching PostgreSQL&apos;s{' '}
            <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">INITCAP()</code>{' '}
            behaviour. Only profiles that differ from titlecase are updated.
            This operation affects only the current campus.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Action card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-[#022172]" />
              Convert Names
            </CardTitle>
            <CardDescription>
              One-time utility — safe to run multiple times (idempotent)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fields updated for each matching profile:
            </p>
            <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
              <li>First Name</li>
              <li>Last Name</li>
              <li>Father Name</li>
              <li>Grandfather Name</li>
            </ul>

            {result !== null && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {result > 0
                  ? <span><strong>{result}</strong> profile{result !== 1 ? 's' : ''} converted successfully.</span>
                  : <span>All names are already in titlecase.</span>
                }
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={converting}
                  className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white w-full"
                >
                  {converting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting…</>
                    : <><Type className="mr-2 h-4 w-4" /> Convert</>
                  }
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Convert Names To Titlecase?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will update first_name, last_name, father_name and grandfather_name
                    for all profiles in this campus. The operation is safe to repeat —
                    only names that are not already in titlecase will be changed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConvert}
                    className="bg-[#022172] hover:bg-[#011558] text-white"
                  >
                    Convert
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Preview card */}
        <Card>
          <CardHeader>
            <CardTitle>Before / After Examples</CardTitle>
            <CardDescription>
              How names will look after conversion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Before</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">After</th>
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE_ROWS.map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-muted/20 border-t' : 'border-t'}>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{row.before}</td>
                      <td className="px-4 py-2 font-medium text-[#022172]">{row.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Uses the same word-boundary logic as PostgreSQL&apos;s <code>INITCAP()</code>.
              Each whitespace-separated word gets its first character capitalised.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
