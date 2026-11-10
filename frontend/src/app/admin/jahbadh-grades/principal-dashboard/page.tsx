"use client"

import { Suspense } from "react"
import { PrincipalDashboard } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><PrincipalDashboard base="/admin/jahbadh-grades" /></Suspense>
}
