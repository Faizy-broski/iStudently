"use client"

import { Suspense } from "react"
import { WeakItems } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><WeakItems base="/teacher/jahbadh-grades" /></Suspense>
}
