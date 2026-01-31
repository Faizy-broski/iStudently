'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StudentSelector } from '@/components/parent/StudentSelector'
import { 
  GraduationCap, 
  BookOpen, 
  CalendarCheck, 
  ClipboardList, 
  CreditCard, 
  User,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ParentDashboardPage() {
  const { selectedStudent, students, isLoading, error } = useParentDashboard()

  const student = students.find(s => s.id === selectedStudent)

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Failed to load dashboard: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const quickLinks = [
    {
      title: 'Academics',
      description: 'View grades & subjects',
      icon: BookOpen,
      href: '/parent/academics',
      color: 'bg-blue-500'
    },
    {
      title: 'Attendance',
      description: 'Check attendance records',
      icon: CalendarCheck,
      href: '/parent/attendance',
      color: 'bg-green-500'
    },
    {
      title: 'Homework',
      description: 'View assignments',
      icon: ClipboardList,
      href: '/parent/homework',
      color: 'bg-purple-500'
    },
    {
      title: 'Fees',
      description: 'Payment status & history',
      icon: CreditCard,
      href: '/parent/fees',
      color: 'bg-orange-500'
    }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parent Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your child&apos;s progress.
          </p>
        </div>
        <StudentSelector />
      </div>

      {/* Selected Student Card */}
      {student && (
        <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              {/* Student Photo */}
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {student.profile_photo_url ? (
                  <Image
                    src={student.profile_photo_url}
                    alt={`${student.first_name}'s photo`}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <User className="h-10 w-10 text-white/70" />
                )}
              </div>
              
              {/* Student Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {student.first_name} {student.last_name}
                </h2>
                <div className="flex flex-wrap gap-4 mt-2 text-white/90">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {student.grade_level}
                  </span>
                  <span>Section: {student.section}</span>
                  <span>ID: {student.student_number}</span>
                </div>
                <p className="text-white/70 mt-1 text-sm">
                  {student.campus_name}
                </p>
              </div>

              {/* Quick ID Card Link */}
              <Link 
                href="/parent/id-card"
                className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <CreditCard className="h-8 w-8" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${link.color}`}>
                    <link.icon className="h-6 w-6 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mt-4">{link.title}</h3>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* No Student Message */}
      {!student && students.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Students Linked</h3>
            <p className="text-muted-foreground">
              No students are linked to your account yet. Please contact the school administration.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Multiple Students Info */}
      {students.length > 1 && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Tip:</strong> You have {students.length} children linked to your account. 
              Use the student selector above to switch between them.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
