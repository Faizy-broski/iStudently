"use client"

import { Suspense } from "react"
import { Activities } from "@/components/jahbadh/Activities"

export default function Page() {
  return <Suspense><Activities base="/admin/jahbadh-grades" /></Suspense>
}
