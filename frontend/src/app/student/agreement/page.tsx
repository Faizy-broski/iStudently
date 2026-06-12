'use client'

import { useState, useEffect } from 'react'
import { getMyAgreement, type AgreementItem } from '@/lib/api/user-agreement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Loader2 } from 'lucide-react'

export default function StudentAgreementPage() {
  const [agreements, setAgreements] = useState<AgreementItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAgreement()
      .then((res) => {
        if (res.success && res.data?.agreements) {
          setAgreements(res.data.agreements)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-[#022172]" />
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">Agreement</h1>
          <p className="text-muted-foreground text-sm">School agreement and terms</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : agreements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No agreement has been configured by the administrator.</p>
          </CardContent>
        </Card>
      ) : (
        agreements.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.title || 'School Agreement'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
