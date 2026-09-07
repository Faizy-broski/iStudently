import type { LucideIcon, LucideProps } from 'lucide-react'

function AbacusIconComponent({ className, size = 24 }: LucideProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/abacus.png"
      alt=""
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

export const AbacusIcon = AbacusIconComponent as unknown as LucideIcon
