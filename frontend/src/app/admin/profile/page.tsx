'use client'

import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Clock, ShieldCheck } from 'lucide-react'
import { UserQRCode } from '@/components/shared/UserQRCode'
import { useTranslations } from 'next-intl'

export default function AdminProfilePage() {
  const { profile, user } = useAuth()
  const t = useTranslations('admin.profile')

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    return 'A'
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Profile Hero Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-[#022172] to-[#57A3CC] h-32" />
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="-mt-24 md:-mt-16 flex-shrink-0">
              <Avatar className="aspect-[3/4] w-32 h-auto rounded-2xl border-4 border-white shadow-lg">
                <AvatarImage src={profile?.profile_photo_url || ''} alt={profile?.first_name || 'Admin'} className="aspect-[3/4] h-full w-full object-cover" />
                <AvatarFallback className="bg-[#022172] text-white text-3xl rounded-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 mt-4 md:mt-0">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profile?.first_name} {profile?.last_name}
                  </h2>
                  <p className="text-muted-foreground">{profile?.email}</p>
                </div>
                <Badge className="bg-[#022172] hover:bg-[#022172] text-white capitalize">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {profile?.role || t('role')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('account_info')}</CardTitle>
          <CardDescription>{t('account_info_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('email')}</p>
              <p className="font-medium">{profile?.email || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
              <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('phone')}</p>
              <p className="font-medium">{profile?.phone || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('last_login')}</p>
              <p className="font-medium">
                {user?.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('role')}</p>
              <p className="font-medium capitalize">{profile?.role || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      {profile?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('qr_title')}</CardTitle>
            <CardDescription>{t('qr_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <UserQRCode
              value={profile.id}
              label={`${profile.first_name || ''} ${profile.last_name || ''} · ${profile.role}`.trim()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
