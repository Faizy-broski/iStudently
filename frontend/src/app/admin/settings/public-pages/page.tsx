'use client'

import { useState, useEffect } from 'react'
import {
  getPublicPagesSettings,
  savePublicPagesSettings,
  ALL_PUBLIC_PAGES,
} from '@/lib/api/public-pages'
import type { PublicPagesConfig, PublicPageId } from '@/lib/api/public-pages'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Globe, Save, Loader2, ExternalLink, Eye, Info } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

const DEFAULT_CONFIG: PublicPagesConfig = {
  pages: [],
  default_page: 'login',
  custom_page_title: '',
  custom_page_content: '',
}

const getPageOptions = (t: any) => [
  { value: 'login', label: t('login_default') },
  ...ALL_PUBLIC_PAGES.map(p => ({ value: p.id, label: t(`pages.${p.id}`) })),
]

export default function PublicPagesSettingsPage() {
  const t = useTranslations('school.public_pages')
  const { profile } = useAuth()

  const [config, setConfig] = useState<PublicPagesConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getPublicPagesSettings().then((res) => {
      if (res.success && res.data) setConfig(res.data.config)
    }).finally(() => setLoading(false))
  }, [])

  // Fetch school slug for the preview link
  useEffect(() => {
    if (!profile?.school_id) return
    import('@/lib/api/schools').then(({ getAuthToken }) =>
      getAuthToken().then(token => {
        if (!token) return
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
        fetch(`${apiUrl}/schools/${profile.school_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.json())
          .then(d => { if (d?.data?.slug) setSchoolSlug(d.data.slug) })
          .catch(() => {})
      })
    )
  }, [profile?.school_id])

  const togglePage = (id: PublicPageId) => {
    setConfig(prev => ({
      ...prev,
      pages: prev.pages.includes(id)
        ? prev.pages.filter(p => p !== id)
        : [...prev.pages, id],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await savePublicPagesSettings(config)
    if (res.success) {
      toast.success(t('msg_save_success'))
    } else {
      toast.error(res.error || t('msg_save_error'))
    }
    setSaving(false)
  }

  const publicUrl = schoolSlug ? `/p/${schoolSlug}` : null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
          </div>
        </div>
        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#57A3CC] hover:underline"
          >
            <Eye className="h-4 w-4" />
            {t('btn_preview')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Activation notice */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-4 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          {t.rich('activation_notice.text', {
            link: (
              <Link href="/admin/settings/plugins" className="font-semibold underline underline-offset-2">
                {t('activation_notice.link_text')}
              </Link>
            ),
            bold: (chunks) => <strong>{chunks}</strong>
          })}
        </div>
      </div>
          {publicUrl && (
            <span className="block mt-1 font-mono text-xs text-blue-700 dark:text-blue-400 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}{publicUrl}
            </span>
          )}

      {/* Pages to show */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('card_visible_title')}</CardTitle>
          <CardDescription>{t('card_visible_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {ALL_PUBLIC_PAGES.map(page => (
              <div key={page.id} className="flex items-center gap-2">
                <Switch
                  id={`page-${page.id}`}
                  checked={config.pages.includes(page.id)}
                  onCheckedChange={() => togglePage(page.id)}
                />
                <Label htmlFor={`page-${page.id}`} className="cursor-pointer">{t(`pages.${page.id}`)}</Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Default page */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('card_default_title')}</CardTitle>
          <CardDescription>{t('card_default_subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={config.default_page}
            onChange={e => setConfig(prev => ({ ...prev, default_page: e.target.value as any }))}
            className="w-full max-w-xs border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#022172]"
          >
            {getPageOptions(t).filter(o => o.value === 'login' || config.pages.includes(o.value as PublicPageId)).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Custom page content */}
      {config.pages.includes('custom') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('card_custom_title')}</CardTitle>
            <CardDescription>{t('card_custom_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="custom-title">{t('label_page_title')}</Label>
              <Input
                id="custom-title"
                value={config.custom_page_title}
                onChange={e => setConfig(prev => ({ ...prev, custom_page_title: e.target.value }))}
                placeholder={t('placeholder_page_title')}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">{t('label_page_content')}</Label>
              <RichTextEditor
                value={config.custom_page_content}
                onChange={(html) => setConfig(prev => ({ ...prev, custom_page_content: html }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#022172] hover:bg-[#022172]/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? t('btn_saving') : t('btn_save')}
        </Button>
      </div>
    </div>
  )
}
