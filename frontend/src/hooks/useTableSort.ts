import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export function sortItems<T, K extends string>(
    data: T[],
    getValue: (item: T, key: K) => string | number,
    sortKey: K,
    sortDir: SortDirection
) {
    const arr = [...data]
    arr.sort((a, b) => {
        const av = getValue(a, sortKey)
        const bv = getValue(b, sortKey)
        const cmp = typeof av === 'string' && typeof bv === 'string'
            ? av.localeCompare(bv)
            : Number(av) - Number(bv)
        return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
}

export function useTableSort<T, K extends string>(
    data: T[],
    getValue: (item: T, key: K) => string | number,
    initialKey: K,
    initialDir: SortDirection = 'desc'
) {
    const [sortKey, setSortKey] = useState<K>(initialKey)
    const [sortDir, setSortDir] = useState<SortDirection>(initialDir)

    const toggleSort = (key: K, defaultDir: SortDirection = 'asc') => {
        if (sortKey === key) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortKey(key)
            setSortDir(defaultDir)
        }
    }

    const sorted = useMemo(
        () => sortItems(data, getValue, sortKey, sortDir),
        [data, sortKey, sortDir, getValue]
    )

    return { sorted, sortKey, sortDir, toggleSort }
}
