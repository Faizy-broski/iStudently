"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  allChecked: boolean;
  someChecked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  title?: string;
}

/**
 * Row-header / column-header "Check All" toggle. Same Set<string>/.every()
 * selection idiom used elsewhere (e.g. SendEmailStudents.tsx), but here
 * onToggle calls straight through to the matrix hook's bulk-sync path —
 * one request for the whole row/column, never N sequential single-item ones.
 */
export function CheckAllControls({ allChecked, someChecked, disabled, onToggle, title }: Props) {
  return (
    <Checkbox
      checked={allChecked ? true : someChecked ? "indeterminate" : false}
      disabled={disabled}
      onCheckedChange={(checked) => onToggle(checked === true)}
      title={title}
    />
  );
}
