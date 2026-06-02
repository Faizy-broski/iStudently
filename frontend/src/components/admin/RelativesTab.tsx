'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, User, Phone, Mail, UserRound } from 'lucide-react'
import { API_URL } from '@/config/api'
import { getAuthToken } from '@/lib/api/schools'

interface Sibling {
  id: string
  student_number: string | null
  grade_level: string | null
  first_name: string | null
  last_name: string | null
  father_name: string | null
  profile_photo_url: string | null
}

interface ParentRelative {
  id: string
  relation_type: string
  relationship: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  profile_photo_url: string | null
}

interface RelativesData {
  siblings: Sibling[]
  parents: ParentRelative[]
}

interface Props {
  studentId: string
}

const RELATION_LABELS: Record<string, string> = {
  father: 'Father',
  mother: 'Mother',
  guardian: 'Guardian',
  other: 'Other',
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        className="rounded-full object-cover w-10 h-10 flex-shrink-0"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
      <UserRound className="h-5 w-5 text-gray-400" />
    </div>
  )
}

export default function RelativesTab({ studentId }: Props) {
  const [data, setData] = useState<RelativesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    getAuthToken().then(token => {
      if (!token) { setError('Authentication required'); setLoading(false); return }
      fetch(`${API_URL}/students/${studentId}/relatives`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(json => {
          if (json.success) setData(json.data)
          else setError(json.error || 'Failed to load relatives')
        })
        .catch(() => setError('Failed to load relatives'))
        .finally(() => setLoading(false))
    })
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  const { siblings = [], parents = [] } = data ?? {}

  return (
    <div className="space-y-6">
      {/* Parents / Guardians */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Parents & Guardians
            <span className="text-sm font-normal text-muted-foreground">({parents.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No parents or guardians linked.</p>
          ) : (
            <div className="space-y-3">
              {parents.map((p, i) => (
                <div key={p.id ?? i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Avatar src={p.profile_photo_url} name={`${p.first_name} ${p.last_name}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      <span className="ml-2 text-xs text-[#57A3CC] font-normal">
                        {RELATION_LABELS[p.relation_type] ?? p.relation_type}
                        {p.relationship && ` (${p.relationship})`}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {p.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{p.phone}
                        </span>
                      )}
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />{p.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Siblings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Siblings
            <span className="text-sm font-normal text-muted-foreground">({siblings.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {siblings.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No siblings found.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Student #</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {siblings.map(s => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={s.profile_photo_url} name={`${s.first_name} ${s.last_name}`} />
                          <div>
                            <Link
                              href={`/admin/students/${encodeURIComponent(s.student_number ?? s.id)}`}
                              className="font-medium hover:text-[#022172] hover:underline"
                            >
                              {[s.first_name, s.father_name, s.last_name].filter(Boolean).join(' ') || 'Unknown'}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.student_number ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.grade_level ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
