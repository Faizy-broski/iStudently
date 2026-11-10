"use client"

import { Suspense } from "react"
import { Statistics } from "@/components/jahbadh/Official"

export default function Page() {
  return <Suspense><Statistics base="/teacher/jahbadh-grades" /></Suspense>
}
