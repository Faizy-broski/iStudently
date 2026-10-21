"use client"

import { Suspense } from "react"
import { StudentProfile } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><StudentProfile base="/admin/jahbadh-grades" /></Suspense>
}
