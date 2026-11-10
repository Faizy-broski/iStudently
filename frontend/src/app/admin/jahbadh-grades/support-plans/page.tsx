"use client"

import { Suspense } from "react"
import { SupportPlans } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><SupportPlans base="/admin/jahbadh-grades" /></Suspense>
}
