import React from 'react';
import { Check } from 'lucide-react';

interface StepItem {
  title: React.ReactNode;
}

interface StepsProps {
  current: number;
  items: StepItem[];
  className?: string;
  isRtl?: boolean;
}

export function Steps({ current, items, className = '', isRtl = false }: StepsProps) {
  return (
    <div className={`flex items-center w-full justify-between select-none ${isRtl ? 'flex-row-reverse' : 'flex-row'} ${className}`}>
      {items.map((item, idx) => {
        const isCompleted = idx < current;
        const isActive = idx === current;
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {/* Step Node */}
            <div className="flex flex-col items-center flex-1 relative">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 z-10 ${
                  isCompleted 
                    ? 'bg-[#34D399] text-black shadow-[0_0_12px_rgba(52,211,153,0.3)]' 
                    : isActive 
                      ? 'bg-[#f5b731] text-black shadow-[0_0_12px_rgba(245,183,49,0.4)] ring-4 ring-[#f5b731]/20' 
                      : 'bg-[#2A2F40] text-[#64748B] border border-[#2E3445] dark:bg-[#2A2F40] dark:border-[#2E3445]'
                }`}
                style={{
                  background: !isCompleted && !isActive ? 'var(--surface-elevated)' : undefined,
                  borderColor: !isCompleted && !isActive ? 'var(--border)' : undefined,
                  color: !isCompleted && !isActive ? 'var(--text-muted)' : undefined,
                }}
              >
                {isCompleted ? <Check size={14} className="stroke-[3]" /> : idx + 1}
              </div>
              <div className="mt-2 text-center">
                {item.title}
              </div>
            </div>

            {/* Connecting Bar */}
            {!isLast && (
              <div 
                className="flex-1 h-[2px] mx-1 relative" 
                style={{ 
                  background: 'var(--border)',
                  top: '-13px'
                }}
              >
                <div 
                  className="absolute top-0 bottom-0 bg-[#34D399] transition-all duration-500"
                  style={{ 
                    width: isCompleted ? '100%' : '0%',
                    right: isRtl ? 0 : 'auto',
                    left: isRtl ? 'auto' : 0
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
