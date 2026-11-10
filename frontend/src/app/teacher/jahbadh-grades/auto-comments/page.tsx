"use client"

import { Suspense } from "react"
import { AutoComments } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><AutoComments base="/teacher/jahbadh-grades" /></Suspense>
}
