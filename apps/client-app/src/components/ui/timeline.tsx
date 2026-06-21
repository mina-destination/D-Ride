"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const TimelineContext = React.createContext<{
  position: "left" | "right" | "alternate" | "center"
}>({ position: "left" })

const TimelineItemContext = React.createContext<{ index: number }>({ index: 0 })

const timelineVariants = cva("flex flex-col list-none m-0 p-0", {
  variants: {
    position: {
      left: "gap-6",
      right: "gap-6",
      alternate: "gap-0",
      center: "gap-0",
    },
  },
  defaultVariants: { position: "left" },
})

interface TimelineProps
  extends React.ComponentProps<"ol">,
    VariantProps<typeof timelineVariants> {}

const Timeline = React.forwardRef<HTMLOListElement, TimelineProps>(
  ({ className, position, children, ...props }, ref) => {
    const timelinePosition = position ?? "left"
    const childrenWithIndex = React.Children.map(children, (child, index) => {
      if (React.isValidElement(child)) {
        return (
          <TimelineItemContext.Provider value={{ index }}>
            {child}
          </TimelineItemContext.Provider>
        )
      }
      return child
    })
    return (
      <TimelineContext.Provider value={{ position: timelinePosition }}>
        <ol
          ref={ref}
          role="list"
          data-slot="timeline"
          data-position={timelinePosition}
          className={cn(timelineVariants({ position: timelinePosition }), className)}
          {...props}
        >
          {childrenWithIndex}
        </ol>
      </TimelineContext.Provider>
    )
  }
)
Timeline.displayName = "Timeline"

const TimelineItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, children, ...props }, ref) => {
    const { position } = React.useContext(TimelineContext)
    const { index } = React.useContext(TimelineItemContext)
    const isRight =
      position === "right" || (position === "alternate" && index % 2 === 1)

    if (position === "center") {
      const isEven = index % 2 === 0
      return (
        <li
          ref={ref}
          role="listitem"
          data-slot="timeline-item"
          data-position={isEven ? "left" : "right"}
          className={cn("relative m-0 grid grid-cols-[1fr_auto_1fr] gap-4 p-0", className)}
          {...props}
        >
          {children}
        </li>
      )
    }
    return (
      <li
        ref={ref}
        role="listitem"
        data-slot="timeline-item"
        data-position={isRight ? "right" : "left"}
        className={cn(
          "relative m-0 flex gap-4 p-0",
          position === "alternate" && "justify-center",
          isRight && "flex-row-reverse",
          className
        )}
        {...props}
      >
        {children}
      </li>
    )
  }
)
TimelineItem.displayName = "TimelineItem"

const timelineMarkerVariants = cva(
  "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
  {
    variants: {
      variant: {
        default: "border-border bg-background",
        primary: "border-primary bg-primary",
        success: "border-green-500 bg-green-500 dark:border-green-600 dark:bg-green-600",
        warning: "border-yellow-500 bg-yellow-500 dark:border-yellow-600 dark:bg-yellow-600",
        destructive: "border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

interface TimelineMarkerProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof timelineMarkerVariants> {
  icon?: React.ReactNode
}

const TimelineMarker = React.forwardRef<HTMLDivElement, TimelineMarkerProps>(
  ({ className, variant, icon, ...props }, ref) => {
    return (
      <div className="relative flex flex-col items-center">
        <div
          ref={ref}
          data-slot="timeline-marker"
          className={cn(timelineMarkerVariants({ variant }), className)}
          {...props}
        >
          {icon ? (
            <div className="flex size-3 items-center justify-center text-current">{icon}</div>
          ) : (
            <div className={cn("size-2 rounded-full", variant === "default" ? "bg-muted-foreground" : "bg-current")} />
          )}
        </div>
        <div
          className="bg-border absolute -top-4 -bottom-4 left-1/2 w-px -translate-x-1/2 [li:first-child_&]:top-6 [li:last-child_&]:bottom-auto [li:last-child_&]:h-full"
          data-slot="timeline-line"
          aria-hidden="true"
        />
      </div>
    )
  }
)
TimelineMarker.displayName = "TimelineMarker"

const TimelineContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    const { position } = React.useContext(TimelineContext)
    const { index } = React.useContext(TimelineItemContext)
    const isRight = position === "right" || (position === "alternate" && index % 2 === 1)
    if (position === "center") {
      const isEven = index % 2 === 0
      return (
        <div ref={ref} data-slot="timeline-content"
          className={cn("flex flex-col gap-1 pb-8", isEven ? "text-right" : "text-left", className)}
          {...props}
        />
      )
    }
    return (
      <div ref={ref} data-slot="timeline-content"
        className={cn(
          "flex flex-1 flex-col gap-1 pb-6",
          position === "alternate" && "w-1/2",
          position === "alternate" && (isRight ? "text-right" : "text-left"),
          className
        )}
        {...props}
      />
    )
  }
)
TimelineContent.displayName = "TimelineContent"

const TimelineSpacer = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="timeline-spacer" className={cn("min-w-0 flex-1", className)} {...props} />
  )
)
TimelineSpacer.displayName = "TimelineSpacer"

const TimelineTitle = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="timeline-title" className={cn("leading-none font-semibold", className)} {...props} />
  )
)
TimelineTitle.displayName = "TimelineTitle"

const TimelineDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="timeline-description" className={cn("text-muted-foreground text-sm", className)} {...props} />
  )
)
TimelineDescription.displayName = "TimelineDescription"

const TimelineTime = React.forwardRef<HTMLTimeElement, React.ComponentProps<"time">>(
  ({ className, ...props }, ref) => (
    <time ref={ref} data-slot="timeline-time" className={cn("text-muted-foreground text-xs", className)} {...props} />
  )
)
TimelineTime.displayName = "TimelineTime"

export {
  Timeline,
  TimelineItem,
  TimelineMarker,
  TimelineContent,
  TimelineSpacer,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
}
