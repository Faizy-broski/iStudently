"use client"

import { Suspense } from "react"
import { WhatIf } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><WhatIf base="/admin/jahbadh-grades" /></Suspense>
}
