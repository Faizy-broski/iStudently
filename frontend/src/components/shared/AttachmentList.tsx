"use client"

import { useState } from "react"
import { FileText, FileImage, FileSpreadsheet, File, Download, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface AttachmentItem {
  id: string
  file_name: string
  file_url: string // may be a public URL or a storage path, depending on resolveUrl
  file_type?: string | null
  file_size?: number | null
}

interface AttachmentListProps {
  attachments: AttachmentItem[]
  /** Resolves file_url/path to an openable URL at click time (e.g. a signed URL). Defaults to using file_url as-is. */
  resolveUrl?: (attachment: AttachmentItem) => Promise<string>
  onDelete?: (attachment: AttachmentItem) => void
  canDelete?: boolean
  emptyText?: string
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function iconFor(fileType?: string | null) {
  if (!fileType) return File
  if (fileType.startsWith("image/")) return FileImage
  if (fileType.includes("sheet") || fileType.includes("excel")) return FileSpreadsheet
  if (fileType.includes("pdf") || fileType.includes("word") || fileType === "text/plain") return FileText
  return File
}

/**
 * Generic attachment list/viewer — reusable across modules. Each row shows a
 * type icon, file name, size, and a download link (resolved on click via
 * `resolveUrl` so callers can use short-lived signed URLs instead of storing
 * a permanent public link).
 */
export function AttachmentList({ attachments, resolveUrl, onDelete, canDelete = false, emptyText = "No attachments" }: AttachmentListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = async (attachment: AttachmentItem) => {
    setDownloadingId(attachment.id)
    try {
      const url = resolveUrl ? await resolveUrl(attachment) : attachment.file_url
      const a = document.createElement("a")
      a.href = url
      a.download = attachment.file_name
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.click()
    } finally {
      setDownloadingId(null)
    }
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const Icon = iconFor(attachment.file_type)
        const isDownloading = downloadingId === attachment.id
        return (
          <div key={attachment.id} className="flex items-center gap-3 p-2 rounded-md border bg-muted/30">
            <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{attachment.file_name}</p>
              {attachment.file_size ? (
                <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={isDownloading}
              onClick={() => handleDownload(attachment)}
              title="Download"
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            {canDelete && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(attachment)}
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
