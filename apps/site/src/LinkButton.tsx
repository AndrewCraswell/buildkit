import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import type { ComponentProps } from "react"
import { buttonVariants } from "./components/ui/Button"

type LinkButtonProps = ComponentProps<"a"> & VariantProps<typeof buttonVariants>

// Navigation keeps native link behavior while sharing the shadcn button styles.
export function LinkButton({ className, variant, size, children, ...props }: LinkButtonProps) {
  return (
    <a data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </a>
  )
}
