"use client"

import { Suspense } from "react"
import { Prediction } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><Prediction base="/admin/jahbadh-grades" /></Suspense>
}
