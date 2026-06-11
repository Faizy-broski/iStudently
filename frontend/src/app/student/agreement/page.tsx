'use client'

import { useState, useEffect } from 'react'
import { getMyAgreement } from '@/lib/api/user-agreement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Loader2 } from 'lucide-react'

export default function StudentAgreementPage() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAgreement()
      .then((res) => {
        if (res.success && res.data) {
          setTitle(res.data.title || 'School Agreement')
          setContent(res.data.content || '')
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

      <Card>
        <CardHeader>
          <CardTitle>{loading ? '…' : title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">No agreement has been configured by the administrator.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
