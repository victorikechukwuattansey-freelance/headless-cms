'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CalendarPost } from '@/types';

interface CalendarViewProps {
  posts: CalendarPost[];
  onDayClick?: (date: Date, posts: CalendarPost[]) => void;
  className?: string;
}

export function CalendarView({ posts, onDayClick, className }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getPostsForDay = (day: Date) =>
    posts.filter((p) => isSameDay(new Date(p.scheduledAt), day));

  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b">
        {weekdays.map((day) => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayPosts = getPostsForDay(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                setSelectedDate(day);
                onDayClick?.(day, dayPosts);
              }}
              className={cn(
                'min-h-[80px] p-1 border-b border-r text-left transition-colors hover:bg-muted/50 relative',
                !isSameMonth(day, currentMonth) && 'text-muted-foreground/40',
                isSelected && 'bg-muted',
                isToday(day) && 'bg-primary/5'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-sm',
                  isToday(day) && 'bg-primary text-primary-foreground font-semibold'
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="space-y-0.5 mt-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <div
                    key={post.id}
                    className="h-1.5 w-full rounded-full bg-primary/60"
                    title={post.title}
                  />
                ))}
                {dayPosts.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayPosts.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
