"use client"

import { Suspense } from "react"
import { TestAnalysis } from "@/components/jahbadh/Tools"

export default function Page() {
  return <Suspense><TestAnalysis base="/admin/jahbadh-grades" /></Suspense>
}
