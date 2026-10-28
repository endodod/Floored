import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "m-still inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-felt disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // Primary by inversion: a white pill with dark text. One per screen.
        default: "btn-glow bg-ink text-ground hover:bg-soft",
        destructive: "border border-loss-tint text-loss hover:bg-loss-tint",
        outline: "border border-control text-ink hover:border-felt hover:bg-felt-tint hover:shadow-[0_0_20px_-6px_rgba(79,174,132,0.6)]",
        secondary: "bg-raised text-ink hover:bg-control",
        ghost: "text-soft hover:text-ink hover:bg-raised",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6 text-sm",
        icon: "h-[34px] w-[34px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
