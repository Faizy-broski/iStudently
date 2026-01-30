'use client'

import Link from 'next/link'
import { GraduationCap, Users, BookOpen, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AcademicsPage() {
  const sections = [
    {
      title: 'Grade Levels',
      description: 'Manage grade levels for your school. Grades are the foundation for sections and subjects.',
      icon: GraduationCap,
      href: '/admin/academics/grades',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Sections',
      description: 'Create and manage classroom sections within each grade level.',
      icon: Users,
      href: '/admin/academics/sections',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Subjects',
      description: 'Define curriculum subjects specific to each grade level.',
      icon: BookOpen,
      href: '/admin/academics/subjects',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Academics</h1>
        <p className="text-muted-foreground mt-2">
          Manage your school's academic structure: grades, sections, and subjects
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${section.color}`} />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={section.href}>
                  <Button variant="outline" className="w-full group">
                    Manage {section.title}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-l-4 border-l-blue-600">
        <CardHeader>
          <CardTitle>School Setup Dependency Chain</CardTitle>
          <CardDescription>
            Understanding how academics are structured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              Step 1: Grade Levels (The Container)
            </h3>
            <p className="text-sm text-muted-foreground">
              Everything starts here. Create grade levels like "Grade 10", "Matric", or "O-Levels". 
              Each grade has an order index (for sorting) and a base monthly fee.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Step 2: Sections (Physical Classrooms)
            </h3>
            <p className="text-sm text-muted-foreground">
              Divide each grade into sections like "Section A", "Blue", or "Girls Wing". 
              Set capacity limits to control enrollment.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              Step 3: Subjects (Curriculum)
            </h3>
            <p className="text-sm text-muted-foreground">
              Define subjects specific to each grade. "Math for Grade 10" is different from "Math for Grade 1". 
              This ensures teachers are only assigned relevant subjects.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-900">
              <strong>Important:</strong> You cannot create a Section without a Grade. 
              You cannot assign a Subject without a Grade. Grade Level is the parent of everything.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
