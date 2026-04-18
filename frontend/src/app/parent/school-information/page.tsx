'use client'

import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Building2, MapPin, Phone, Mail, Users, Hash, Globe, ExternalLink,
} from 'lucide-react'
import Image from 'next/image'

export default function ParentSchoolInformationPage() {
  const campusContext = useCampus()
  const campus = campusContext?.selectedCampus

  if (!campus) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Campus Data</h3>
              <p className="text-muted-foreground text-sm">
                School information could not be loaded. Please try again later.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const infoRows = [
    { icon: Hash, label: 'Campus Number / Code', value: campus.school_number },
    { icon: Users, label: 'Principal', value: campus.principal_name },
    { icon: Phone, label: 'Phone', value: campus.phone },
    { icon: Mail, label: 'Email', value: campus.contact_email },
    { icon: Globe, label: 'Short Name', value: campus.short_name },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          School Information
        </h1>
        <p className="text-muted-foreground">Details for {campus.name}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {campus.logo_url && (
                <Image
                  src={campus.logo_url}
                  alt={`${campus.name} logo`}
                  width={64}
                  height={64}
                  className="rounded object-contain border"
                />
              )}
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-5 w-5 text-[#022172]" />
                  {campus.name}
                </CardTitle>
                {campus.short_name && (
                  <CardDescription>Short Name: {campus.short_name}</CardDescription>
                )}
              </div>
            </div>
            <Badge variant={campus.status === 'active' ? 'default' : 'secondary'}>
              {campus.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Separator />

          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Address</p>
              {campus.address ? (
                <>
                  <p className="text-sm text-muted-foreground">{campus.address}</p>
                  {(campus.city || campus.state || campus.zip_code) && (
                    <p className="text-sm text-muted-foreground">
                      {[campus.city, campus.state, campus.zip_code].filter(Boolean).join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not provided</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{value || 'Not provided'}</p>
                </div>
              </div>
            ))}

            {campus.website && (
              <div className="flex items-center gap-3">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Website</p>
                  <a
                    href={campus.website.startsWith('http') ? campus.website : `https://${campus.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {campus.website}
                  </a>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
