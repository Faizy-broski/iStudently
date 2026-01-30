'use client'

import { User, Mail, Phone, Calendar, MapPin, Lock } from 'lucide-react'

export default function ProfilePage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-600 mt-1">View and manage your account information</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Profile Management Coming Soon</h3>
        <p className="text-gray-600 mb-4">You'll be able to view and update your profile information here</p>
        <p className="text-sm text-gray-500">Contact your administrator for profile changes</p>
      </div>
    </div>
  )
}
