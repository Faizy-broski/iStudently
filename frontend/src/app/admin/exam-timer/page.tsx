"use client"

import dynamic from "next/dynamic"

// Client only: the timer's state lives in this browser (reload continuity, offline use).
const ExamTimer = dynamic(() => import("@/components/jahbadh/timer/ExamTimer").then((m) => m.ExamTimer), { ssr: false })

export default function Page() {
  return <ExamTimer />
}
