"use client"

import { Suspense } from "react"
import { ClassHome } from "@/components/jahbadh/ClassHome"

export default function Page() {
  return <Suspense><ClassHome base="/teacher/jahbadh-grades" /></Suspense>
}
