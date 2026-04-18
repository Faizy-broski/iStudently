'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, User, Lock, Save, Mail, Phone, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile, changePassword } from '@/lib/api/auth'

export default function StudentProfilePage() {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [phone, setPhone] = useState('')
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirm: '' })

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const result = await updateProfile({ phone })
      if (!result.success) throw new Error(result.error)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setChangingPw(true)
    try {
      const result = await changePassword(passwordForm.newPassword)
      if (!result.success) throw new Error(result.error)
      toast.success('Password changed successfully')
      setPasswordForm({ newPassword: '', confirm: '' })
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Student'
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'S'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">My Profile</h1>
        <p className="text-muted-foreground mt-1">View and manage your account information</p>
      </div>

      {/* Avatar & Name */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{fullName}</h2>
            <p className="text-muted-foreground capitalize">{profile?.role}</p>
            <p className="text-sm text-muted-foreground mt-1">{profile?.email}</p>
          </div>
        </div>
      </Card>

      {/* Contact Info */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Contact Information</h2>
            <p className="text-sm text-muted-foreground">Update your phone number</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email Address
            </label>
            <Input value={profile?.email ?? ''} disabled className="bg-gray-50" />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed. Contact your administrator.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4" /> Phone Number
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-red-100">
            <Lock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Change Password</h2>
            <p className="text-sm text-muted-foreground">Update your account password</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">New Password</label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Confirm Password</label>
            <Input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              placeholder="Re-enter new password"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPw || !passwordForm.newPassword}
            variant="outline"
          >
            {changingPw ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
            Change Password
          </Button>
        </div>
      </Card>

      {/* Account Info */}
      <Card className="p-6 bg-gray-50">
        <h3 className="font-semibold mb-4">Account Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Student ID:</span>
            <span className="font-medium">{profile?.student_id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium capitalize">{profile?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since:</span>
            <span className="font-medium">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
