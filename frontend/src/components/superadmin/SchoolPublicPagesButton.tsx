'use client'

import * as React from 'react'
import { Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PublicPagesManager } from '@/components/superadmin/PublicPagesManager'

interface SchoolPublicPagesButtonProps {
  schoolId: string
  schoolName: string
}

export function SchoolPublicPagesButton({ schoolId, schoolName }: SchoolPublicPagesButtonProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        size="sm"
        className="w-full gradient-blue text-white hover:shadow-md transition-all border-0 h-8"
        onClick={() => setOpen(true)}
      >
        <Globe className="h-3.5 w-3.5 me-1.5" />
        Public Pages
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-white" />
              </div>
              Public Pages — {schoolName}
            </DialogTitle>
            <DialogDescription>
              Custom link tabs shown on the school login page.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <PublicPagesManager schoolId={schoolId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
