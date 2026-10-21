"use client"

import { Suspense } from "react"
import { SecondRound } from "@/components/jahbadh/ResultsSheet"

export default function Page() {
  return <Suspense><SecondRound base="/admin/jahbadh-grades" /></Suspense>
}
