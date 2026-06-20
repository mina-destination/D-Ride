import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "text"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    
    const variantStyles = {
      default: "bg-primary text-text-onPrimary shadow hover:bg-primary-hover",
      destructive: "bg-danger text-white shadow-sm hover:opacity-90",
      outline: "border border-border bg-transparent shadow-sm hover:bg-surface-hover text-text-primary",
      secondary: "bg-surface-elevated text-text-primary shadow-sm hover:bg-surface-hover",
      ghost: "hover:bg-surface-hover hover:text-text-primary text-text-secondary",
      link: "text-primary underline-offset-4 hover:underline",
      text: "bg-transparent text-text-primary hover:bg-surface-hover"
    }

    const sizeStyles = {
      default: "h-9 px-4 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-8",
      icon: "h-9 w-9 rounded-full",
    }

    return (
      <button
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className || ""}`}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
