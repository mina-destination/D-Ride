import * as React from "react"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

interface TooltipContextType {
  visible: boolean
  setVisible: (visible: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined)

export function Tooltip({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ visible, setVisible }}>
      <div
        className="relative inline-block"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

export function TooltipTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>
}

export function TooltipContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(TooltipContext)
  if (!context?.visible) return null

  return (
    <div
      className={`absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-slate-900 dark:bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-md ${className || ""}`}
      style={{ whiteSpace: "nowrap" }}
      {...props}
    >
      {children}
      <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-950" />
    </div>
  )
}
