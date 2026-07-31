import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, isToday } from 'date-fns';

interface CalendarProps {
  month: Date;
  onMonthChange: (date: Date) => void;
  selected?: Date;
  onSelect?: (date: Date) => void;
  modifiers?: Record<string, Date[]>;
  modifiersStyles?: Record<string, React.CSSProperties>;
  className?: string;
}

function Calendar({ month, onMonthChange, selected, onSelect, modifiers, modifiersStyles, className }: CalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={cn('p-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1))}
          className="p-1 hover:bg-muted rounded-md"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-semibold">{format(month, 'MMMM yyyy')}</div>
        <button
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1))}
          className="p-1 hover:bg-muted rounded-md"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((day) => (
          <div key={day} className="text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const isSelected = selected && isSameDay(day, selected);
          const isCurrentMonth = isSameMonth(day, month);
          const today = isToday(day);

          let customStyle: React.CSSProperties | undefined;
          if (modifiers && modifiersStyles) {
            for (const [key, dates] of Object.entries(modifiers)) {
              if (dates.some((d) => isSameDay(d, day))) {
                customStyle = modifiersStyles[key];
                break;
              }
            }
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect?.(day)}
              className={cn(
                'h-8 w-8 rounded-md text-sm transition-colors',
                !isCurrentMonth && 'text-muted-foreground/40',
                isSelected && 'bg-primary text-primary-foreground',
                !isSelected && isCurrentMonth && 'hover:bg-muted',
                today && !isSelected && 'border border-primary'
              )}
              style={customStyle}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
