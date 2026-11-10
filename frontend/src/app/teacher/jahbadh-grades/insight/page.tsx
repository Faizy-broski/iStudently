"use client"

import { Suspense } from "react"
import { InsightHub } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><InsightHub base="/teacher/jahbadh-grades" /></Suspense>
}
