'use client'

import { TableHead } from '@/components/ui/table'
import { IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import type { SortDirection } from '@/hooks/useTableSort'

interface SortableTableHeadProps<K extends string> {
    label: React.ReactNode
    sortKey: K
    activeKey: K
    direction: SortDirection
    onSort: (key: K) => void
    align?: 'left' | 'right'
    className?: string
}

export function SortableTableHead<K extends string>({
    label,
    sortKey,
    activeKey,
    direction,
    onSort,
    align = 'left',
    className,
}: SortableTableHeadProps<K>) {
    const active = activeKey === sortKey

    return (
        <TableHead
            className={cn('cursor-pointer select-none hover:text-foreground', align === 'right' && 'text-end', className)}
            onClick={() => onSort(sortKey)}
        >
            <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end w-full')}>
                {label}
                {active ? (
                    direction === 'asc' ? <IconArrowUp className="h-3.5 w-3.5" /> : <IconArrowDown className="h-3.5 w-3.5" />
                ) : (
                    <IconArrowsSort className="h-3.5 w-3.5 opacity-40" />
                )}
            </span>
        </TableHead>
    )
}
