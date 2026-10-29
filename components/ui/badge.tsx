import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-raised text-soft",
        secondary: "bg-felt-tint text-felt",
        destructive: "bg-loss-tint text-loss",
        outline: "border border-control text-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
