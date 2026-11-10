"use client"

import { Suspense } from "react"
import { OfficialHub } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><OfficialHub base="/admin/jahbadh-grades" /></Suspense>
}
