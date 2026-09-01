"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { DeliveryRecord } from "@/lib/api/textbook-deliveries";

interface Props {
  delivery: DeliveryRecord | null | undefined;
  hasOverduePayments: boolean;
  isPending: boolean;
  /** Whether the viewer's role can bypass a financial block (admin/super_admin). */
  canOverride: boolean;
  onToggle: (next: boolean, override?: boolean) => void;
}

/**
 * One (student, book) cell. Every click fires its own immediate request
 * (handled by the caller via onToggle -> useTextbookDeliveryMatrix.toggleCell)
 * — this is a deliberate divergence from the gradebook matrix's batch-save
 * pattern, not something to "fix" back.
 *
 * The disabled/red state here is a UX hint only; the backend re-checks the
 * financial gate on every write regardless of what this renders.
 */
export function DeliveryCheckbox({ delivery, hasOverduePayments, isPending, canOverride, onToggle }: Props) {
  const t = useTranslations("textbooks.matrix");
  const isDelivered = !!delivery?.is_delivered;
  const blocked = hasOverduePayments && !isDelivered;

  if (isPending) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Checkbox
        checked={isDelivered}
        disabled={blocked && !canOverride}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      {blocked && canOverride && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-[10px] text-red-600 hover:text-red-700"
          onClick={() => onToggle(true, true)}
        >
          {t("override")}
        </Button>
      )}
    </div>
  );
}
