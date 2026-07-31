import { Box, Ellipse, Group, Line, Text } from '@opencanva/core';
import type { Artboard, DesignMeta, Scene } from '@opencanva/core';

const BrandShowcase: Scene = () => (
  <>
    {/* Decorative accent */}
    <Ellipse x={900} y={-160} w={500} h={500} fill="var(--ox-accent)" opacity={0.04} />
    <Ellipse x={-80} y={780} w={360} h={360} fill="var(--ox-accent2)" opacity={0.06} />

    {/* ── Logo Lockup ── */}
    <Group x={80} y={80} name="Logo Lockup">
      <Box x={0} y={0} w={56} h={56} radius={4} fill="var(--ox-accent)" />
      <Text x={0} y={0} w={56} h={56} align="center" valign="center" size={28} weight={300} color="var(--ox-bg)" font="display" letterSpacing={2}>
        L
      </Text>
      <Text x={80} y={-2} w={500} size={52} weight={300} color="var(--ox-fg)" font="display" letterSpacing={4} uppercase>
        Luxe Café
      </Text>
      <Text x={80} y={60} w={500} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={3} uppercase>
        Premium coffee &amp; artisanal fare
      </Text>
    </Group>

    <Line x={80} y={180} w={920} thickness={1} color="var(--ox-accent2)" opacity={0.3} />

    {/* ── Brand Story ── */}
    <Group x={80} y={220} name="Brand Story">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>
        Brand Story
      </Text>
      <Text x={0} y={28} w={920} size={14} weight={400} color="var(--ox-muted)" font="body" lineHeight={1.7}>
        Luxe Café was born from a belief that coffee should be more than a morning ritual — it should be an experience.
        Inspired by the world's great coffee houses, we created a space where precision meets warmth, and every detail
        is intentional. From our single-origin espresso to our hand-crafted pastries, everything at Luxe Café reflects
        our commitment to quality, elegance, and genuine hospitality.
      </Text>
    </Group>

    {/* ── Color Palette ── */}
    <Group x={80} y={340} name="Color Palette">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>
        Color Palette
      </Text>
      <Box x={0} y={28} w={160} h={96} radius={8} fill="var(--ox-accent)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#3C3028</Text>
      </Box>
      <Box x={176} y={28} w={160} h={96} radius={8} fill="var(--ox-accent2)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#C9A86C</Text>
      </Box>
      <Box x={352} y={28} w={160} h={96} radius={8} fill="var(--ox-muted)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#8A8280</Text>
      </Box>
      <Box x={528} y={28} w={160} h={96} radius={8} fill="var(--ox-bg)" borderColor="var(--ox-muted)" borderWidth={1}>
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-fg)" font="body">#FDFBF7</Text>
      </Box>
      <Box x={704} y={28} w={160} h={96} radius={8} fill="var(--ox-fg)">
        <Text x={0} y={72} w={160} align="center" size={11} weight={500} color="var(--ox-bg)" font="body">#1C1C1A</Text>
      </Box>
    </Group>

    {/* ── Typography ── */}
    <Group x={80} y={500} name="Typography">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>
        Typography
      </Text>
      <Text x={0} y={32} w={700} size={48} weight={400} color="var(--ox-fg)" font="display" letterSpacing={1}>
        Cormorant Garamond
      </Text>
      <Text x={0} y={88} w={600} size={13} weight={400} color="var(--ox-muted)" font="body">
        Display — elegant serif for headlines, logo, menu headers, quotes
      </Text>
      <Text x={0} y={132} w={600} size={18} weight={400} color="var(--ox-fg)" font="body" lineHeight={1.5}>
        Inter — clean sans-serif for body copy, menu items, labels
      </Text>
      <Text x={0} y={172} w={600} size={13} weight={400} color="var(--ox-muted)" font="body">
        Body — descriptions, pricing, navigation, digital copy
      </Text>
    </Group>

    {/* ── Logo Variations ── */}
    <Group x={80} y={620} name="Logo Variations">
      <Text x={0} y={0} w={400} size={11} weight={600} color="var(--ox-accent2)" font="body" letterSpacing={3} uppercase>
        Logo System
      </Text>

      <Group x={0} y={28} name="Primary">
        <Box x={0} y={0} w={36} h={36} radius={4} fill="var(--ox-accent)" />
        <Text x={0} y={0} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={48} y={-2} w={300} size={22} weight={300} color="var(--ox-fg)" font="display" letterSpacing={3} uppercase>Luxe Café</Text>
        <Text x={48} y={24} w={300} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee</Text>
      </Group>

      <Group x={360} y={28} name="Icon Mark">
        <Box x={0} y={0} w={44} h={44} radius={6} fill="var(--ox-accent)" />
        <Text x={0} y={0} w={44} h={44} align="center" valign="center" size={22} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={56} y={12} w={200} size={12} weight={400} color="var(--ox-muted)" font="body">Icon mark</Text>
      </Group>

      <Group x={0} y={88} name="Monochrome">
        <Box x={0} y={0} w={36} h={36} radius={4} fill="var(--ox-fg)" />
        <Text x={0} y={0} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-bg)" font="display">L</Text>
        <Text x={48} y={-2} w={300} size={22} weight={300} color="var(--ox-fg)" font="display" letterSpacing={3} uppercase>Luxe Café</Text>
        <Text x={48} y={24} w={300} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee</Text>
      </Group>

      <Group x={360} y={88} name="Reversed">
        <Box x={0} y={0} w={36} h={36} radius={4} fill="var(--ox-bg)" />
        <Text x={0} y={0} w={36} h={36} align="center" valign="center" size={18} weight={300} color="var(--ox-accent)" font="display">L</Text>
        <Text x={48} y={-2} w={300} size={22} weight={300} color="var(--ox-bg)" font="display" letterSpacing={3} uppercase>Luxe Café</Text>
        <Text x={48} y={24} w={300} size={9} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>Premium coffee</Text>
      </Group>
    </Group>

    {/* Footer */}
    <Line x={80} y={800} w={920} thickness={1} color="var(--ox-accent2)" opacity={0.3} />
    <Text x={80} y={820} w={600} size={11} weight={400} color="var(--ox-muted)" font="body" letterSpacing={2} uppercase>
      Luxe Café — Premium Visual Identity System
    </Text>
  </>
);

BrandShowcase.id = 'luxe-brand';
BrandShowcase.label = 'Brand Showcase';

export const meta: DesignMeta = {
  theme: 'luxe',
  title: 'Luxe Café — Brand Identity',
  createdAt: '2026-07-27T00:00:00.000Z',
};

export const artboard: Artboard = { w: 1080, h: 1080 };

export default [BrandShowcase] satisfies Scene[];
