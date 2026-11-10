"use client"

import { Suspense } from "react"
import { TopStudents } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><TopStudents base="/admin/jahbadh-grades" /></Suspense>
}
