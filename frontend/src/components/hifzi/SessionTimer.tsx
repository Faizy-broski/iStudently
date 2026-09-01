'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Counts up from `startedAt`. Remounting (key={studentId}) resets it per student. */
export function SessionTimer({ startedAt }: { startedAt: number }) {
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [])

    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))

    return (
        <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {formatElapsed(elapsedSeconds)}
        </span>
    )
}
