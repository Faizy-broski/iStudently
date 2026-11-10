"use client"

import { Suspense } from "react"
import { MonthlyCards } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><MonthlyCards base="/admin/jahbadh-grades" /></Suspense>
}
