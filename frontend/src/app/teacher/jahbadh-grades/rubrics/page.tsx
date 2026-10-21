"use client"

import { Suspense } from "react"
import { Rubrics } from "@/components/jahbadh/Tools"

export default function Page() {
  return <Suspense><Rubrics base="/teacher/jahbadh-grades" /></Suspense>
}
