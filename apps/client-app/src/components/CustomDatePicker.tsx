import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  min?: string;  // YYYY-MM-DD
  onChange: (dateStr: string) => void;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAYS_AR = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

export function CustomDatePicker({ value, min, onChange }: CustomDatePickerProps) {
  const { language, isRtl } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date
  const parsedValue = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  // Keep track of the month/year currently viewed in the calendar grid
  const [viewDate, setViewDate] = useState(() => {
    if (!value) return new Date();
    const [y, m] = value.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  // Sync viewed month when value changes (if dropdown is closed)
  useEffect(() => {
    if (!isOpen && value) {
      const [y, m] = value.split('-').map(Number);
      setViewDate(new Date(y, m - 1, 1));
    }
  }, [value, isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Parse min date limit
  const parsedMin = useMemo(() => {
    if (!min) return null;
    const [y, m, d] = min.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [min]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        const dropdown = document.querySelector('.custom-datepicker-dropdown');
        if (dropdown && dropdown.contains(target)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Format the date to local YYYY-MM-DD
  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Check if two dates represent the same day
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Check if date is in the past compared to min limit
  const isBeforeMin = (date: Date) => {
    if (!parsedMin) return false;
    // Compare only year, month, date
    const dCopy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const minCopy = new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate());
    return dCopy.getTime() < minCopy.getTime();
  };

  // Generate grid cells
  const cells = useMemo(() => {
    const tempCells = [];
    
    // First day of current month (0 = Sunday, 1 = Monday, ...)
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    
    // Days in current month
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    
    // Days in previous month
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const today = new Date();

    // 1. Previous month buffer days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const date = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      tempCells.push({
        date,
        isCurrentMonth: false,
        isDisabled: isBeforeMin(date),
        isSelected: isSameDay(date, parsedValue),
        isToday: isSameDay(date, today)
      });
    }

    // 2. Current month days
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(viewYear, viewMonth, i);
      tempCells.push({
        date,
        isCurrentMonth: true,
        isDisabled: isBeforeMin(date),
        isSelected: isSameDay(date, parsedValue),
        isToday: isSameDay(date, today)
      });
    }

    // 3. Next month buffer days to complete 6 rows (42 cells)
    const remainingCells = 42 - tempCells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(viewYear, viewMonth + 1, i);
      tempCells.push({
        date,
        isCurrentMonth: false,
        isDisabled: isBeforeMin(date),
        isSelected: isSameDay(date, parsedValue),
        isToday: isSameDay(date, today)
      });
    }

    return tempCells;
  }, [viewYear, viewMonth, parsedValue, parsedMin]);

  // Navigate months
  const prevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Formatted date string for button display
  const displayString = useMemo(() => {
    if (!value) return language === 'ar' ? 'اختر التاريخ' : 'Select Date';
    const dayName = parsedValue.getDate();
    const monthName = language === 'ar' ? MONTHS_AR[parsedValue.getMonth()] : MONTHS_EN[parsedValue.getMonth()];
    const yearName = parsedValue.getFullYear();

    if (language === 'ar') {
      return `${dayName} ${monthName} ${yearName}`;
    }
    return `${monthName} ${dayName}, ${yearName}`;
  }, [value, parsedValue, language]);

  const monthLabel = language === 'ar' ? MONTHS_AR[viewMonth] : MONTHS_EN[viewMonth];
  const daysHeader = language === 'ar' ? DAYS_AR : DAYS_EN;

  const handleCellClick = (date: Date, isDisabled: boolean) => {
    if (isDisabled) return;
    onChange(formatLocalDate(date));
    setIsOpen(false);
  };

  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  const updatePosition = () => {
    if (containerRef.current) {
      setTriggerRect(containerRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScroll = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  return (
    <div className="custom-datepicker-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        className="custom-datepicker-trigger"
        onClick={() => { updatePosition(); setIsOpen(!isOpen); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 14px',
          background: 'var(--surface-elevated)',
          border: isOpen ? '1px solid var(--primary)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? 'var(--shadow-glow)' : 'none',
          textAlign: isRtl ? 'right' : 'left',
          flexDirection: isRtl ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <CalendarIcon size={16} style={{ color: 'var(--primary)' }} />
          <span>{displayString}</span>
        </span>
      </button>

      {isOpen && triggerRect && createPortal(
        <div
          className="custom-datepicker-dropdown"
          style={{
            position: 'fixed',
            top: triggerRect.bottom + 8,
            left: isRtl ? triggerRect.right - 280 : triggerRect.left,
            width: '280px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px',
            zIndex: 9999,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            userSelect: 'none'
          }}
        >
          {/* Calendar Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            <button
              type="button"
              onClick={prevMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronLeft size={18} />
            </button>
            
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
              {monthLabel} {viewYear}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekdays Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '6px', textAlign: 'center', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            {daysHeader.map((d, index) => (
              <span key={index} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', textAlign: 'center', flexDirection: isRtl ? 'row-reverse' : 'row' }}>
            {cells.map((cell, index) => {
              let cellBg = 'transparent';
              let cellColor = 'var(--text-primary)';
              let border = '1px solid transparent';
              let cursor = 'pointer';
              let opacity = 1;

              if (!cell.isCurrentMonth) {
                opacity = 0.4;
              }

              if (cell.isDisabled) {
                cellColor = 'var(--text-muted)';
                cursor = 'not-allowed';
                opacity = 0.25;
              } else if (cell.isSelected) {
                cellBg = 'var(--primary)';
                cellColor = 'black';
              } else if (cell.isToday) {
                border = '1px dashed var(--primary)';
              }

              return (
                <div
                  key={index}
                  onClick={() => handleCellClick(cell.date, cell.isDisabled)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    fontWeight: cell.isSelected || cell.isToday ? 700 : 500,
                    background: cellBg,
                    color: cellColor,
                    border,
                    cursor,
                    opacity,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!cell.isDisabled && !cell.isSelected) {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!cell.isDisabled && !cell.isSelected) {
                      e.currentTarget.style.background = cellBg;
                    }
                  }}
                >
                  {cell.date.getDate()}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
