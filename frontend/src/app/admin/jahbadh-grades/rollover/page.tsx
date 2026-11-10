"use client"

import { Suspense } from "react"
import { Rollover } from "@/components/jahbadh/Rollover"

export default function Page() {
  return <Suspense><Rollover base="/admin/jahbadh-grades" /></Suspense>
}
