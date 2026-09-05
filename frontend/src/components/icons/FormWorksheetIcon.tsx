import type { LucideIcon, LucideProps } from 'lucide-react'

function FormWorksheetIconComponent({ className, size = 24 }: LucideProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/form.png"
      alt=""
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

export const FormWorksheetIcon = FormWorksheetIconComponent as unknown as LucideIcon
