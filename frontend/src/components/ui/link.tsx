// Custom Link wrapper that disables prefetch by default for static export
import NextLink, { LinkProps } from 'next/link'
import React from 'react'

interface CustomLinkProps extends Omit<LinkProps, 'prefetch'> {
  prefetch?: boolean
  children: React.ReactNode
  className?: string
}

export function Link({ 
  prefetch = false, // Default to false for static export
  children, 
  ...props 
}: CustomLinkProps) {
  return (
    <NextLink prefetch={prefetch} {...props}>
      {children}
    </NextLink>
  )
}

export default Link
