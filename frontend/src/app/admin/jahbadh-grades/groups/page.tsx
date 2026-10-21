"use client"

import { Suspense } from "react"
import { LearningGroups } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><LearningGroups base="/admin/jahbadh-grades" /></Suspense>
}
