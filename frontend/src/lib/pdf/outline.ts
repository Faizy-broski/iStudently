/**
 * Table-of-contents helpers built on pdf.js's own `getOutline()` API (no
 * native/PDFium bookmark-tree walking needed — pdf.js already hands back a
 * resolved JS tree).
 *
 * Two shapes are kept side by side because they serve different consumers:
 * - `TocTreeNode[]` (nested) — what the TOC panel renders, indentation and all.
 * - `FlatOutlineEntry[]` (flat, sorted by page) — what page-indexed lookups
 *   (chapter-context for bookmarks, search results, etc.) binary/linear-search over.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface TocTreeNode {
  title: string
  pageIndex: number | null
  depth: number
  /** Dotted position in the tree, e.g. "0.2.1" — stable across renders/filters, usable as a React key or expand-state key. */
  path: string
  children: TocTreeNode[]
}

export interface FlatOutlineEntry {
  pageIndex: number
  title: string
  depth: number
  breadcrumb: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawOutlineItem = any

async function resolvePageIndex(pdfDocument: PDFDocumentProxy, dest: RawOutlineItem): Promise<number | null> {
  try {
    let destArray = dest
    if (typeof dest === 'string') {
      destArray = await pdfDocument.getDestination(dest)
    }
    if (!destArray || !destArray[0]) return null
    const pageIndex = await pdfDocument.getPageIndex(destArray[0])
    return pageIndex
  } catch {
    return null
  }
}

async function buildTree(
  pdfDocument: PDFDocumentProxy,
  items: RawOutlineItem[],
  depth: number,
  parentPath: string
): Promise<TocTreeNode[]> {
  const nodes = await Promise.all(
    items.map(async (item, index): Promise<TocTreeNode> => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`
      const pageIndex = await resolvePageIndex(pdfDocument, item.dest)
      const children = item.items?.length ? await buildTree(pdfDocument, item.items, depth + 1, path) : []
      return { title: item.title ?? '', pageIndex, depth, path, children }
    })
  )
  return nodes
}

/** Builds the nested outline tree, or `null` if the PDF has no table of contents. */
export async function getOutlineTree(pdfDocument: PDFDocumentProxy): Promise<TocTreeNode[] | null> {
  const raw = await pdfDocument.getOutline()
  if (!raw || raw.length === 0) return null
  return buildTree(pdfDocument, raw, 0, '')
}

function flatten(nodes: TocTreeNode[], breadcrumb: string[], out: FlatOutlineEntry[]) {
  for (const node of nodes) {
    const path = [...breadcrumb, node.title]
    if (node.pageIndex !== null) {
      out.push({ pageIndex: node.pageIndex, title: node.title, depth: node.depth, breadcrumb: path })
    }
    if (node.children.length) flatten(node.children, path, out)
  }
}

/** Flattens a tree into a page-sorted list, for chapter-context lookups. */
export function flattenOutline(tree: TocTreeNode[]): FlatOutlineEntry[] {
  const out: FlatOutlineEntry[] = []
  flatten(tree, [], out)
  out.sort((a, b) => a.pageIndex - b.pageIndex)
  return out
}

/**
 * The deepest/last TOC entry at or before `pageIndex` — i.e. "which chapter
 * is this page in." Returns `null` if there's no outline, or the page
 * precedes every entry.
 */
export function findChapterForPage(flatOutline: FlatOutlineEntry[], pageIndex: number): FlatOutlineEntry | null {
  let result: FlatOutlineEntry | null = null
  for (const entry of flatOutline) {
    if (entry.pageIndex <= pageIndex) result = entry
    else break
  }
  return result
}

/**
 * Tree-preserving filter: a node survives if its own title matches, or any
 * descendant's does — so ancestor chapters stay visible when only a nested
 * subsection matches the query.
 */
export function filterOutlineTree(nodes: TocTreeNode[], query: string): TocTreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function filterNode(node: TocTreeNode): TocTreeNode | null {
    const selfMatches = node.title.toLowerCase().includes(q)
    const filteredChildren = node.children.map(filterNode).filter((n): n is TocTreeNode => n !== null)
    if (!selfMatches && filteredChildren.length === 0) return null
    return { ...node, children: filteredChildren }
  }

  return nodes.map(filterNode).filter((n): n is TocTreeNode => n !== null)
}
