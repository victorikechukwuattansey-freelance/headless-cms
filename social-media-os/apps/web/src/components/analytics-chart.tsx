'use client';

import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface Series {
  key: string;
  name: string;
  color: string;
}

interface AnalyticsChartProps {
  variant?: 'line' | 'bar' | 'area';
  data: DataPoint[];
  series: Series[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  className?: string;
}

export function AnalyticsChart({
  variant = 'line',
  data,
  series,
  height = 300,
  showGrid = true,
  showLegend = true,
  className,
}: AnalyticsChartProps) {
  const ChartComponent = variant === 'bar' ? BarChart : variant === 'area' ? AreaChart : LineChart;
  const DataComponent = variant === 'bar' ? Bar : variant === 'area' ? Area : Line;

  const dataProps = (s: Series) =>
    variant === 'bar'
      ? { dataKey: s.key, fill: s.color, radius: [4, 4, 0, 0] as [number, number, number, number] }
      : variant === 'area'
      ? { dataKey: s.key, stroke: s.color, fill: s.color, fillOpacity: 0.1 }
      : { dataKey: s.key, stroke: s.color, strokeWidth: 2, dot: { r: 3 } };

  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
            }}
          />
          {showLegend && <Legend />}
          {series.map((s) => (
            <DataComponent key={s.key} {...dataProps(s)} />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
