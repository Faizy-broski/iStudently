'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getParentAgreementConfig } from '@/lib/api/parent-agreement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Loader2 } from 'lucide-react'

export default function StudentAgreementPage() {
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentAgreementConfig(profile?.school_id ?? null)
      .then((res) => {
        if (res.success && res.data) {
          setTitle(res.data.title || 'School Agreement')
          setContent(res.data.content || '')
        }
      })
      .finally(() => setLoading(false))
  }, [profile?.school_id])

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
