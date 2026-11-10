"use client"

import { Suspense } from "react"
import { MarkingSheets } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><MarkingSheets base="/admin/jahbadh-grades" /></Suspense>
}
