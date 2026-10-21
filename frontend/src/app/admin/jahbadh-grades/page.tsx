"use client"

import { Suspense } from "react"
import { ClassHome } from "@/components/jahbadh/ClassHome"

export default function Page() {
  return <Suspense><ClassHome base="/admin/jahbadh-grades" /></Suspense>
}
