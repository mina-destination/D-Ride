import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-primary text-text-onPrimary hover:opacity-80",
    secondary: "border-transparent bg-surface-elevated text-text-secondary hover:bg-surface-hover",
    destructive: "border-transparent bg-danger text-white hover:opacity-80",
    outline: "text-text-primary border-border",
    success: "border-transparent bg-success/15 text-success border border-success/30",
    warning: "border-transparent bg-warning/15 text-warning border border-warning/30",
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none ${variantStyles[variant]} ${className || ""}`}
      {...props}
    />
  )
}
