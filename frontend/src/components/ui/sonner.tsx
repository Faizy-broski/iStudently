"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:border-2 group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:font-semibold",
          description: "group-[.toast]:font-medium",
          actionButton:
            "group-[.toast]:bg-red-600 group-[.toast]:text-white group-[.toast]:hover:bg-red-700",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-600 group-[.toast]:hover:bg-gray-200",
          success: "!text-green-700 !border-green-300 !bg-green-50",
          error: "!text-red-700 !border-red-300 !bg-red-50",
          warning: "!text-yellow-700 !border-yellow-300 !bg-yellow-50",
          info: "!text-blue-700 !border-blue-300 !bg-blue-50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
