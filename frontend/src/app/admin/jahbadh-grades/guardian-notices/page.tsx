"use client"

import { Suspense } from "react"
import { GuardianNotices } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><GuardianNotices base="/admin/jahbadh-grades" /></Suspense>
}
