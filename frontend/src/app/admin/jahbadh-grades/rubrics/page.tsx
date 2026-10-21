"use client"

import { Suspense } from "react"
import { Rubrics } from "@/components/jahbadh/Tools"

export default function Page() {
  return <Suspense><Rubrics base="/admin/jahbadh-grades" /></Suspense>
}
