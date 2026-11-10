"use client"

import { Suspense } from "react"
import { MonthlyCurve } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><MonthlyCurve base="/teacher/jahbadh-grades" /></Suspense>
}
