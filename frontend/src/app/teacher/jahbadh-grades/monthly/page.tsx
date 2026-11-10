"use client"

import { Suspense } from "react"
import { MonthlyLog } from "@/components/jahbadh/MonthlyLog"

export default function Page() {
  return <Suspense><MonthlyLog base="/teacher/jahbadh-grades" /></Suspense>
}
