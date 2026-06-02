'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCampus } from '@/context/CampusContext'
import {
  getParentAgreementConfig,
  updateParentAgreementConfig,
} from '@/lib/api/parent-agreement'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { toast } from 'sonner'
import { FileText, Save, Loader2, Info } from 'lucide-react'

export default function ParentAgreementSettingsPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getParentAgreementConfig(campusId)
      if (res.success && res.data) {
        setTitle(res.data.title || '')
        setContent(res.data.content || '')
      }
    } catch {
      // Silently fail — fields stay empty
    } finally {
      setLoading(false)
    }
  }, [campusId])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Agreement title is required')
      return
    }
    if (!content.trim() || content.trim() === '<p></p>') {
      toast.error('Agreement content is required')
      return
    }

    setSaving(true)
    try {
      const res = await updateParentAgreementConfig({ title: title.trim(), content }, campusId)
      if (res.success) {
        toast.success('Parent agreement configuration saved')
      } else {
        toast.error(res.error || 'Failed to save configuration')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Agreement</h1>
          <p className="text-sm text-muted-foreground">
            Configure the agreement that parents must accept each academic year
          </p>
        </div>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">How It Works</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>When the plugin is active, parents must accept the agreement before accessing the portal.</li>
            <li>Acceptance is required once per academic year. When a new academic year starts, parents must accept again.</li>
            <li>Students with linked parents cannot access the system until their parent has accepted.</li>
            <li>Students without linked parents are not affected and can log in normally.</li>
            <li>Each campus can configure its own agreement title and content.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Agreement Configuration</CardTitle>
          <CardDescription>
            Set the title and content that parents will see when they log in.
            {campusId && <span className="ml-1 text-xs text-blue-600">(Campus-specific)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="agreement-title">Agreement Title</Label>
            <Input
              id="agreement-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School Policies & Terms of Service"
              disabled={saving}
            />
          </div>

          {/* Content (Rich Text) */}
          <div className="space-y-2">
            <Label>Agreement Content</Label>
            <RichTextEditor
              value={content}
              onChange={setContent}
              campusId={campusId || undefined}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-brand-blue hover:bg-brand-blue/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
