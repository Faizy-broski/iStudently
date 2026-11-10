"use client"

import { Suspense } from "react"
import { ReviewSheet } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><ReviewSheet base="/admin/jahbadh-grades" /></Suspense>
}
