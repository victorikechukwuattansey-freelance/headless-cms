import { Box, Text, Ellipse, Line, Group, Icon } from '@opencanva/core';

// ── Palette convenience ──
export const C = {
  charcoal: '#1a1a1a',
  cream: '#faf6f0',
  terracotta: '#c8553d',
  olive: '#6b8f5e',
  gold: '#e8b84b',
  white: '#ffffff',
  muted: '#64748b',
};

// ── Header bar: 1080×80 restaurant name strip ──
export function HeaderBar({ name, bg }: { name: string; bg?: string }) {
  return (
    <Box x={0} y={0} w={1080} h={80} fill={bg ?? C.white}>
      <Box x={0} y={0} w={6} h={80} fill={C.terracotta} />
      <Text x={24} y={0} w={500} h={80} valign="center" size={28} weight={700} color={bg ? '#fff' : C.charcoal} font="display">
        {name}
      </Text>
    </Box>
  );
}

// ── Photo placeholder (gray gradient area) ──
export function PhotoArea({ x, y, w, h, label, radius }: { x: number; y: number; w: number; h: number; label?: string; radius?: number }) {
  return (
    <Box x={x} y={y} w={w} h={h} fill="#e8ddcf" radius={radius ?? 0}>
      <Box x={0} y={0} w={w} h={h} radius={radius ?? 0} fill="linear-gradient(135deg, #d4c5b0, #e8ddcf)" />
      <Text x={0} y={0} w={w} h={h} align="center" valign="center" size={16} color="#a09080" font="body">
        {label ?? '📷 Photo'}
      </Text>
    </Box>
  );
}

// ── Badge (pill shape) ──
export function Badge({ x, y, text, color }: { x: number; y: number; text: string; color?: 'terracotta' | 'olive' | 'gold' }) {
  const bg = color === 'gold' ? C.gold : color === 'olive' ? C.olive : C.terracotta;
  const textColor = color === 'gold' ? C.charcoal : C.white;
  return (
    <Box x={x} y={y} w={text.length * 8 + 24} h={32} radius={16} fill={bg}>
      <Text x={0} y={0} w={text.length * 8 + 24} h={32} align="center" valign="center" size={12} weight={700} color={textColor} font="body" uppercase letterSpacing={0.5}>
        {text}
      </Text>
    </Box>
  );
}

// ── CTA Button ──
export function CTAButton({ x, y, text, w }: { x: number; y: number; text: string; w?: number }) {
  const bw = w ?? 220;
  return (
    <Box x={x} y={y} w={bw} h={48} radius={8} fill={C.terracotta}>
      <Text x={0} y={0} w={bw} h={48} align="center" valign="center" size={14} weight={600} color={C.white} font="body">
        {text}
      </Text>
    </Box>
  );
}

// ── Price tag (gold badge) ──
export function PriceTag({ x, y, price }: { x: number; y: number; price: string }) {
  const bw = price.length * 10 + 28;
  return (
    <Box x={x} y={y} w={bw} h={36} radius={18} fill={C.gold}>
      <Text x={0} y={0} w={bw} h={36} align="center" valign="center" size={18} weight={700} color={C.charcoal} font="display">
        {price}
      </Text>
    </Box>
  );
}

// ── Star rating row ──
export function StarRating({ x, y, count, size }: { x: number; y: number; count: number; size?: number }) {
  const s = size ?? 16;
  return (
    <Group x={x} y={y} name="StarRating">
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} x={i * (s + 4)} y={0} w={s} h={s} size={s} color={C.gold} font="body">
          {i < count ? '★' : '☆'}
        </Text>
      ))}
    </Group>
  );
}

// ── Divider ──
export function Divider({ x, y, w, color }: { x: number; y: number; w?: number; color?: string }) {
  return <Line x={x} y={y} w={w ?? 640} thickness={2} color={color ?? C.terracotta} />;
}

// ── Overlay gradient (bottom-up dark fade) ──
export function PhotoOverlay({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children?: React.ReactNode }) {
  return (
    <Box x={x} y={y} w={w} h={h} fill="linear-gradient(0deg, rgba(0,0,0,0.6), transparent 50%)">
      {children}
    </Box>
  );
}

// ── Quote block ──
export function QuoteBlock({ x, y, w, text, color }: { x: number; y: number; w: number; text: string; color?: string }) {
  return (
    <Group x={x} y={y} name="Quote">
      <Text x={0} y={0} w={24} h={32} size={28} color={C.terracotta} font="display">
        "
      </Text>
      <Text x={24} y={4} w={w - 48} size={18} italic color={color ?? C.charcoal} font="display">
        {text}
      </Text>
    </Group>
  );
}

// ── Hours row (for open hours template) ──
export function HoursRow({ x, y, day, time }: { x: number; y: number; day: string; time: string }) {
  return (
    <Group x={x} y={y} name={`Hours-${day}`}>
      <Text x={0} y={0} w={200} size={14} color={C.muted} font="body">
        {day}
      </Text>
      <Text x={320} y={0} w={200} size={14} weight={600} color={C.charcoal} font="body">
        {time}
      </Text>
      <Line x={0} y={26} w={520} thickness={1} color="#eee" />
    </Group>
  );
}
